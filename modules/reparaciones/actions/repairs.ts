"use server";

import { z } from "zod";
import { Prisma, RepairJobStatus } from "@prisma/client";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";
import { santoDomingoDateString } from "@/modules/garantias/lib/document-number";
import { createEvent } from "@/modules/garantias/actions/warranty";
import { assignCasesToTechnician } from "@/modules/garantias/actions/warranty";
import { revalidatePath } from "next/cache";

const REPAIR_RATE_FALLBACK = 50; // RD$ por equipo reparado (fórmula SDigitalSystem)

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = (error: unknown): Result<never> => {
  console.error("[reparaciones] Error en operación", error);
  return { success: false, error: "No se pudo completar la operación. Inténtalo nuevamente." };
};

type RepairDashboardPayload = {
  isAdmin: boolean;
  data: {
    queue: Array<{ id: string; caseCode: string; imei: string; model: string; clientName: string; problem: string; entryDate: Date }>;
    queuePage: number;
    queuePageSize: number;
    queueTotal: number;
    queueHasMore: boolean;
    myJobs: Array<{
      id: string;
      jobCode: string;
      status: RepairJobStatus;
      observaciones: string | null;
      totalEquipos: number;
      montoTotal: Prisma.Decimal;
      createdAt: Date;
      items: Array<{ id: string; imei: string; modelo: string | null; cliente: string; problema: string; resultado: "REPAIRED" | "UNREPAIRED"; warrantyCaseId: string | null }>;
    }>;
    stats: { enCola: number; trabajosPendientes: number; pendienteEquipos: number; totalPagado: number; saldoWallet: number };
  } | null;
};

type ApproveRepairJobResult = { jobCode: string; equipos: number; montoPorEquipo: number; montoTotal: number };

const repairDashboardInputSchema = z.object({
  queuePage: z.coerce.number().int().min(1).max(1000).default(1),
  queuePageSize: z.coerce.number().int().min(10).max(50).default(50),
});

// ============================================================
// Listado y envío desde garantías
// ============================================================

export async function getRepairTechniciansAction() {
  try {
    await requirePermission("reparaciones.read");
    const technicians = await prisma.user.findMany({
      where: { status: "ACTIVE", allowedModules: { has: "reparaciones" } },
      select: { id: true, name: true, username: true, roleCode: true },
      orderBy: { name: "asc" },
    });
    return ok(technicians);
  } catch (error) {
    return fail(error);
  }
}

/**
 * "Enviar a Reparaciones" desde garantías: asigna los casos al técnico real
 * (status → IN_REPAIR + assignedTechnicianId + documento TECN).
 * Reutiliza el flujo de garantías (assign) con technicianId.
 */
export async function sendCasesToRepairsAction(input: { caseCodes: string[]; technicianId: string }): Promise<Result<{ documentCode: string; status: string }>> {
  try {
    await requirePermission("warranties.transition");
    const parsed = z.object({ caseCodes: z.array(z.string().min(1)).min(1).max(100), technicianId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos inválidos." };
    const result = await assignCasesToTechnician({ caseCodes: parsed.data.caseCodes, technicianId: parsed.data.technicianId });
    if (!result.success) return result;
    if (!result.data.documentCode) return { success: false, error: "No se generó el documento de entrega a reparaciones." };
    return ok({ documentCode: result.data.documentCode, status: result.data.status });
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Tarifa por técnico (fórmula System: tecnico_garantia_pago)
// ============================================================

export async function getTechnicianRepairRatesAction() {
  try {
    await requirePermission("reparaciones.read");
    const rates = await prisma.technicianRepairRate.findMany({
      include: { technician: { select: { id: true, name: true, username: true } } },
      orderBy: { fechaConfiguracion: "desc" },
    });
    return ok(rates);
  } catch (error) {
    return fail(error);
  }
}

export async function saveTechnicianRepairRateAction(input: { technicianId: string; montoPorReparacion: number; activo: boolean }) {
  try {
    const actor = await requirePermission("reparaciones.write");
    const parsed = z.object({
      technicianId: z.string().min(1),
      montoPorReparacion: z.number().min(0).max(100000),
      activo: z.boolean(),
    }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Monto inválido." };

    const { technicianId, montoPorReparacion, activo } = parsed.data;
    const existing = await prisma.technicianRepairRate.findUnique({ where: { technicianId } });

    if (existing) {
      await prisma.technicianRepairRate.update({
        where: { technicianId },
        data: { montoPorReparacion, activo, adminId: actor.id, fechaConfiguracion: new Date() },
      });
    } else {
      await prisma.technicianRepairRate.create({
        data: { technicianId, montoPorReparacion, activo, adminId: actor.id },
      });
    }

    await logAudit({ userId: actor.id, action: "repair_rate.upsert", module: "reparaciones", entityType: "technician_repair_rate", entityId: technicianId, afterData: { technicianId, montoPorReparacion, activo } });
    revalidatePath("/reparaciones");
    revalidatePath("/reparaciones/config");
    return ok({ technicianId, montoPorReparacion, activo });
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Dashboard del técnico (cola + mis trabajos + wallet)
// ============================================================

export async function getRepairDashboardAction(input?: unknown): Promise<Result<RepairDashboardPayload>> {
  try {
    await requirePermission("reparaciones.read");
    const parsedInput = repairDashboardInputSchema.safeParse(input ?? {});
    if (!parsedInput.success) return { success: false, error: "Parámetros de paginación inválidos." };
    const { queuePage, queuePageSize } = parsedInput.data;
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };
    if (persisted.roleCode === "ADMIN") return ok({ isAdmin: true, data: null });

    const queueWhere = { assignedTechnicianId: persisted.id, status: "IN_REPAIR" as const, archivedAt: null };
    const [queue, queueTotal, myJobs, wallet] = await Promise.all([
      // Cola: casos de garantía enviados a este técnico (IN_REPAIR + assignedTechnicianId)
      prisma.warrantyCase.findMany({
        where: queueWhere,
        orderBy: { entryDate: "asc" },
        skip: (queuePage - 1) * queuePageSize,
        take: queuePageSize + 1,
        select: { id: true, caseCode: true, imei: true, model: true, clientName: true, problem: true, entryDate: true },
      }),
      prisma.warrantyCase.count({ where: queueWhere }),
      // Trabajos reportados por mí (pendientes y pagados)
      prisma.repairJob.findMany({
        where: { technicianId: persisted.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { items: { select: { id: true, imei: true, modelo: true, cliente: true, problema: true, resultado: true, warrantyCaseId: true } } },
      }),
      prisma.wallet.findUnique({ where: { userId: persisted.id }, select: { balance: true } }),
    ]);

    const pendingJobs = myJobs.filter((j) => j.status === "PENDING_PAYMENT");
    const paidJobs = myJobs.filter((j) => j.status === "PAID");
    const totalPagado = paidJobs.reduce((acc, j) => acc + Number(j.montoTotal), 0);
    const pendienteEquipos = pendingJobs.reduce((acc, j) => acc + j.items.filter((item) => item.resultado === "REPAIRED").length, 0);

    return ok({
      isAdmin: false,
      data: {
        queue: queue.slice(0, queuePageSize),
        queuePage,
        queuePageSize,
        queueTotal,
        queueHasMore: queue.length > queuePageSize,
        myJobs,
        stats: {
          enCola: queueTotal,
          trabajosPendientes: pendingJobs.length,
          pendienteEquipos,
          totalPagado,
          saldoWallet: Number(wallet?.balance ?? 0),
        },
      },
    });
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Reporte de trabajo realizado (técnico)
// Fórmula System (reportarTrabajosRealizados): anti-doble-pago por IMEI.
// ============================================================

const repairItemSchema = z.object({
  imei: z.string().trim().min(5, "IMEI/SN requerido").max(40),
  marca: z.string().trim().max(120).optional(),
  modelo: z.string().trim().max(120).optional(),
  problema: z.string().trim().min(3, "Describa el problema").max(1000),
  cliente: z.string().trim().min(2, "Nombre de cliente requerido").max(160),
  resultado: z.enum(["REPAIRED", "UNREPAIRED"]).default("REPAIRED"),
  warrantyCaseId: z.string().optional(),
});

const reportRepairWorkSchema = z.object({
  observaciones: z.string().trim().max(1000).optional(),
  items: z.array(repairItemSchema).min(1, "Debe agregar al menos un equipo").max(100),
});

export async function reportRepairWorkAction(input: unknown): Promise<Result<{ jobId: string; jobCode: string; montoPorEquipo: number; montoTotal: number; documentCodes: string[] }>> {
  try {
    const actor = await requirePermission("reparaciones.write");
    const parsed = reportRepairWorkSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const { observaciones, items } = parsed.data;
    const technicianId = actor.id;

    // 1. Duplicados dentro de la misma lista
    const seen = new Set<string>();
    for (const item of items) {
      const key = item.imei.toUpperCase();
      if (seen.has(key)) return { success: false, error: `El IMEI "${item.imei}" está duplicado en este reporte.` };
      seen.add(key);
    }
    const cleanImeis = Array.from(seen);

    // 2. Anti-doble-pago: IMEI ya reportado (pendiente de pago) o ya pagado
    const existing = await prisma.repairJobItem.findMany({
      where: {
        job: { status: { in: [RepairJobStatus.PENDING_PAYMENT, RepairJobStatus.PAID] } },
        OR: cleanImeis.map((imei) => ({ imei: { equals: imei, mode: "insensitive" as const } })),
      },
      select: { imei: true, job: { select: { jobCode: true, status: true } } },
    });
    if (existing.length > 0) {
      const first = existing[0];
      const msg = first.job.status === "PAID"
        ? `El equipo con IMEI "${first.imei}" ya fue reportado y pagado anteriormente (${first.job.jobCode}).`
        : `El IMEI "${first.imei}" ya fue reportado y está pendiente de pago (${first.job.jobCode}).`;
      return { success: false, error: msg };
    }

    // 3. Validar que los warranty cases referenciados me pertenecen y están IN_REPAIR
    const caseIds = items.map((i) => i.warrantyCaseId).filter((v): v is string => Boolean(v));
    let linkedCases: { id: string; caseCode: string }[] = [];
    if (caseIds.length > 0) {
      linkedCases = await prisma.warrantyCase.findMany({
        where: { id: { in: caseIds }, assignedTechnicianId: technicianId, status: "IN_REPAIR", archivedAt: null },
        select: { id: true, caseCode: true },
      });
      if (linkedCases.length !== new Set(caseIds).size) {
        return { success: false, error: "Uno o más casos de garantía no están asignados a ti o ya no están en reparación." };
      }
    }

    // 4. Tarifa vigente del técnico
    const rate = await prisma.technicianRepairRate.findUnique({ where: { technicianId } });
    const montoPorEquipo = rate?.activo ? Number(rate.montoPorReparacion) : REPAIR_RATE_FALLBACK;

    const result = await prisma.$transaction(async (tx) => {
      const jobCode = await nextOperationalNumber(tx, "REPAIR_JOB", "REP");
      const job = await tx.repairJob.create({
        data: {
          jobCode,
          technicianId,
          observaciones: observaciones || null,
          totalEquipos: items.length,
          montoPorEquipo,
          montoTotal: items.filter((item) => item.resultado === "REPAIRED").length * montoPorEquipo,
        },
      });

      await tx.repairJobItem.createMany({
        data: items.map((item) => ({
          jobId: job.id,
          // Guardar el identificador normalizado evita que un mismo IMEI/SN
          // se cuele después por diferencias de espacios o mayúsculas.
          imei: item.imei.trim().toUpperCase(),
          marca: item.marca || null,
          modelo: item.modelo || null,
          problema: item.problema,
          cliente: item.cliente,
          resultado: item.resultado,
          warrantyCaseId: item.warrantyCaseId || null,
        })),
      });

      // 5. Cada caso vinculado conserva su resultado: reparado o no reparado.
      const documentCodes: string[] = [];
      if (linkedCases.length > 0) {
        const actorName = actor.name ?? actor.email ?? "Técnico";
        for (const item of items) {
          if (!item.warrantyCaseId) continue;
          const linked = linkedCases.find((c) => c.id === item.warrantyCaseId);
          if (!linked) continue;
          const repaired = item.resultado === "REPAIRED";
          const toStatus = repaired ? "TECHNICIAN_REPORTED_REPAIRED" : "TECHNICIAN_REPORTED_UNREPAIRED";
          const eventType = repaired ? "TECHNICIAN_REPORTED_REPAIRED" : "TECHNICIAN_REPORTED_UNREPAIRED";
          const updatedCase = await tx.warrantyCase.updateMany({
            where: { id: linked.id, status: "IN_REPAIR" },
            data: { status: toStatus, updatedById: actor.id },
          });
          if (updatedCase.count !== 1) throw new Error(`El caso ${linked.caseCode} cambió mientras se reportaba. Recarga e inténtalo nuevamente.`);
          await createEvent(tx, linked.id, actor, eventType, {
            fromStatus: "IN_REPAIR",
            toStatus,
            counterpartyName: actorName,
            reason: repaired ? observaciones || "Trabajo reparado por el técnico." : observaciones || "El técnico reportó que no se pudo reparar.",
          });
        }
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "repair.report",
            module: "reparaciones",
            entityType: "RepairJob",
            entityId: job.id,
            afterData: { jobCode, items: items.length, linkedCases: linkedCases.map((c) => c.caseCode), documentCodes },
          },
        });
      } else {
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "repair.report",
            module: "reparaciones",
            entityType: "RepairJob",
            entityId: job.id,
            afterData: { jobCode, items: items.length, direct: true },
          },
        });
      }

      return { job, jobCode, documentCodes };
    });

    revalidatePath("/reparaciones");
    revalidatePath("/garantias");
    const reparados = items.filter((item) => item.resultado === "REPAIRED").length;
    return ok({ jobId: result.job.id, jobCode: result.jobCode, montoPorEquipo, montoTotal: reparados * montoPorEquipo, documentCodes: result.documentCodes });
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Aprobación y pago (admin)
// Fórmula System (aprobaryPayLoteTrabajo): N equipos × tarifa → wallet.
// ============================================================

export async function getPendingRepairJobsAction() {
  try {
    await requirePermission("reparaciones.write");
    const jobs = await prisma.repairJob.findMany({
      where: { status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "asc" },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            username: true,
            repairRates: { take: 1, orderBy: { fechaConfiguracion: "desc" } },
            wallet: { select: { balance: true } },
          },
        },
        items: { orderBy: { createdAt: "asc" }, select: { id: true, imei: true, marca: true, modelo: true, cliente: true, problema: true, resultado: true, warrantyCaseId: true } },
      },
    });
    return ok(jobs);
  } catch (error) {
    return fail(error);
  }
}

export async function approveRepairJobAction(input: { jobId: string; customMonto?: number; saveAsDefault?: boolean }): Promise<Result<ApproveRepairJobResult>> {
  try {
    const actor = await requirePermission("reparaciones.write");
    const parsed = z.object({
      jobId: z.string().min(1),
      customMonto: z.number().min(0).max(100000).optional(),
      saveAsDefault: z.boolean().optional(),
    }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos inválidos." };

    const { jobId, customMonto, saveAsDefault } = parsed.data;

    return await prisma.$transaction(async (tx) => {
      const job = await tx.repairJob.findUnique({
        where: { id: jobId },
        include: { items: true, technician: { select: { id: true, name: true, username: true } } },
      });
      if (!job) throw new Error("Trabajo no encontrado");
      if (job.status !== "PENDING_PAYMENT") throw new Error("Este trabajo ya fue procesado.");

      // Tarifa: custom > config del técnico > fallback 50
      let montoPorEquipo = customMonto;
      if (montoPorEquipo === undefined) {
        const rate = await tx.technicianRepairRate.findUnique({ where: { technicianId: job.technicianId } });
        montoPorEquipo = rate?.activo ? Number(rate.montoPorReparacion) : REPAIR_RATE_FALLBACK;
      } else if (saveAsDefault) {
        const existing = await tx.technicianRepairRate.findUnique({ where: { technicianId: job.technicianId } });
        if (existing) {
          await tx.technicianRepairRate.update({
            where: { technicianId: job.technicianId },
            data: { montoPorReparacion: customMonto, activo: true, adminId: actor.id, fechaConfiguracion: new Date() },
          });
        } else {
          await tx.technicianRepairRate.create({
            data: { technicianId: job.technicianId, montoPorReparacion: customMonto, activo: true, adminId: actor.id },
          });
        }
      }

      const repairedItems = job.items.filter((item) => item.resultado === "REPAIRED");
      const unrepairedItems = job.items.length - repairedItems.length;
      const montoTotal = repairedItems.length * montoPorEquipo;

      // Un trabajo compuesto únicamente por equipos no reparados también debe
      // cerrarse al aprobarlo, pero no debe crear un movimiento de wallet por
      // RD$0. Mientras permanezca PENDING_PAYMENT vuelve a aparecer como deuda.
      if (repairedItems.length === 0) {
        await tx.repairJob.update({
          where: { id: job.id },
          data: { status: "PAID", approvedById: actor.id, approvedAt: new Date(), montoPorEquipo, montoTotal: 0 },
        });

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "repair.approve_no_pay",
            module: "reparaciones",
            entityType: "RepairJob",
            entityId: job.id,
            afterData: {
              jobCode: job.jobCode,
              equiposReportados: job.items.length,
              equiposPagados: 0,
              equiposNoPagados: unrepairedItems,
              montoPorEquipo,
              montoTotal: 0,
              date: santoDomingoDateString(),
            },
          },
        });

        return { success: true as const, data: { jobCode: job.jobCode, equipos: 0, montoPorEquipo, montoTotal: 0 } };
      }

      // Idempotencia: cada job paga una sola vez
      const externalKey = `repair-payment:${job.id}:${job.technicianId}`;
      const existingPayment = await tx.walletLedgerEntry.findUnique({ where: { externalKey } });
      if (existingPayment) throw new Error("Este trabajo ya fue pagado.");

      // Wallet del técnico (se crea si no existe)
      let wallet = await tx.wallet.findUnique({
        where: { userId: job.technicianId },
        include: { accounts: { where: { kind: "PRIMARY" } } },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: job.technicianId, balance: 0 },
          include: { accounts: { where: { kind: "PRIMARY" } } },
        });
      }
      let account = wallet.accounts[0];
      if (!account) {
        account = await tx.walletAccount.create({
          data: { walletId: wallet.id, name: "Principal", kind: "PRIMARY", balance: 0 },
        });
      }

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          accountId: account.id,
          type: "CREDIT",
          amount: montoTotal,
          description: `Pago por Reparaciones: ${job.jobCode} (${repairedItems.length} reparado(s) × RD$${montoPorEquipo}; ${unrepairedItems} no reparado(s) sin pago)`,
          externalKey,
          actorId: actor.id,
        },
      });
      await tx.walletAccount.update({ where: { id: account.id }, data: { balance: { increment: montoTotal } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: montoTotal } } });

      // Marcar pagado
      await tx.repairJob.update({
        where: { id: job.id },
        data: { status: "PAID", approvedById: actor.id, approvedAt: new Date(), montoPorEquipo, montoTotal },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "repair.approve_pay",
          module: "reparaciones",
          entityType: "RepairJob",
          entityId: job.id,
          afterData: { jobCode: job.jobCode, equiposReportados: job.items.length, equiposPagados: repairedItems.length, equiposNoPagados: unrepairedItems, montoPorEquipo, montoTotal, externalKey, date: santoDomingoDateString() },
        },
      });

       return { success: true as const, data: { jobCode: job.jobCode, equipos: repairedItems.length, montoPorEquipo, montoTotal } };
    });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  } finally {
    revalidatePath("/reparaciones");
    revalidatePath("/reparaciones/pagos");
    revalidatePath("/wallet");
    revalidatePath("/garantias");
    revalidatePath("/dashboard");
  }
}
