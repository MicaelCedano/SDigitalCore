"use server";

import { z } from "zod";
import { Prisma, UnlockRequestStatus } from "@prisma/client";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { santoDomingoDateString } from "@/modules/garantias/lib/document-number";
import { revalidatePath } from "next/cache";

const UNLOCK_RATE = 25; // RD$ fijo por desbloqueo (fórmula SDigitalSystem)

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = (error: unknown): Result<never> => {
  console.error("[desbloqueos] Error en operación", error);
  return { success: false, error: "No se pudo completar la operación. Inténtalo nuevamente." };
};

// ============================================================
// Validación de IMEI (fórmula System: Luhn + anti-basura)
// ============================================================

function validarImei(imei: string): { valid: boolean; error?: string } {
  if (!imei || typeof imei !== "string") return { valid: false, error: "vacío" };
  const s = imei.trim();
  if (!/^\d+$/.test(s)) return { valid: false, error: "contiene letras o símbolos" };
  if (s.length !== 15) return { valid: false, error: `debe tener 15 dígitos (tiene ${s.length})` };
  if (new Set(s).size === 1) return { valid: false, error: "todos los dígitos son iguales" };
  const digits = s.split("").map(Number);
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    let d = digits[fromRight];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  if (total % 10 !== 0) return { valid: false, error: "checksum Luhn inválido" };
  return { valid: true };
}

// ============================================================
// Crear solicitud (técnico) — fórmula System crearSolicitudDesbloqueo
// ============================================================

const createUnlockRequestSchema = z.object({
  model: z.string().trim().min(1, "El modelo es obligatorio").max(150),
  imeis: z.array(z.string().trim()).min(1, "Debes enviar al menos un IMEI").max(100),
  observacion: z.string().trim().max(1000).optional(),
});

export async function createUnlockRequestAction(input: unknown): Promise<Result<{ requestId: string; requestCode: string; totalEquipos: number }>> {
  try {
    const actor = await requirePermission("desbloqueos.write");
    const parsed = createUnlockRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const { model, imeis, observacion } = parsed.data;

    // Duplicados en la lista
    const setImeis = new Set(imeis);
    if (setImeis.size !== imeis.length) {
      const counts = new Map<string, number>();
      for (const i of imeis) counts.set(i, (counts.get(i) || 0) + 1);
      const duplicados = Array.from(counts.entries()).filter(([, c]) => c > 1).map(([imei]) => imei);
      return { success: false, error: `Hay IMEIs repetidos en la lista: ${duplicados.join(", ")}` };
    }

    // Formato de cada IMEI (Luhn + anti-basura)
    for (const imei of imeis) {
      const v = validarImei(imei);
      if (!v.valid) return { success: false, error: `IMEI inválido (${imei}): ${v.error}` };
    }

    // Anti-doble-pago: IMEIs ya desbloqueados antes (unlock_record @unique)
    const yaDesbloqueados = await prisma.unlockRecord.findMany({
      where: { imei: { in: imeis } },
      select: { imei: true, technician: { select: { name: true } } },
    });
    if (yaDesbloqueados.length > 0) {
      const lista = yaDesbloqueados.map((r) => `${r.imei} (por ${r.technician.name || "—"})`).join(", ");
      return { success: false, error: `Estos IMEIs ya fueron desbloqueados: ${lista}` };
    }

    // IMEIs en otra solicitud pendiente
    const solicitudesAbiertas = await prisma.unlockRequest.findMany({
      where: { status: "PENDING_ADMIN" },
      select: { imeis: true },
    });
    const enProceso = new Set<string>();
    for (const sol of solicitudesAbiertas) {
      const lista = (sol.imeis as Array<string | { imei: string }>) || [];
      for (const item of lista) {
        const v = typeof item === "string" ? item : item?.imei;
        if (v) enProceso.add(v);
      }
    }
    const conflicto = imeis.filter((i) => enProceso.has(i));
    if (conflicto.length > 0) {
      return { success: false, error: `Estos IMEIs ya están en otra solicitud pendiente: ${conflicto.join(", ")}` };
    }

    // Código único DESB-{userTag}-{fecha}-{suffix} (fórmula System)
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { username: true, name: true } });
    const userTag = (user?.username || user?.name || "user").replace(/[^a-zA-Z0-9]/g, "");
    const dateStr = santoDomingoDateString().replaceAll("-", "");
    const baseCode = `DESB-${userTag}-${dateStr}`;
    const lastSol = await prisma.unlockRequest.findFirst({
      where: { requestCode: { startsWith: baseCode } },
      orderBy: { createdAt: "desc" },
    });
    let suffix = 1;
    if (lastSol) {
      const parts = lastSol.requestCode.split("-");
      const lastSuffix = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSuffix)) suffix = lastSuffix + 1;
    }
    const requestCode = `${baseCode}-${suffix}`;

    // Guardar IMEIs como JSON [{imei}]
    const imeisJson = imeis.map((i) => ({ imei: i }));

    const request = await prisma.unlockRequest.create({
      data: {
        requestCode,
        technicianId: actor.id,
        model,
        imeis: imeisJson as unknown as Prisma.InputJsonValue,
        status: "PENDING_ADMIN",
        observacion: observacion || null,
        totalEquipos: imeis.length,
        montoPorEquipo: UNLOCK_RATE,
        montoTotalPagado: 0,
      },
    });

    await logAudit({
      userId: actor.id,
      action: "unlock.request.create",
      module: "desbloqueos",
      entityType: "UnlockRequest",
      entityId: request.id,
      afterData: { requestCode, model, totalEquipos: imeis.length, montoTotal: imeis.length * UNLOCK_RATE },
    });

    revalidatePath("/desbloqueos");
    return ok({ requestId: request.id, requestCode, totalEquipos: imeis.length });
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Listar solicitudes (técnico ve las suyas, admin ve todas)
// ============================================================

export async function getUnlockRequestsAction(): Promise<Result<unknown[]>> {
  try {
    await requirePermission("desbloqueos.read");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };

    const requests = await prisma.unlockRequest.findMany({
      where: persisted.roleCode === "ADMIN" ? {} : { technicianId: persisted.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            username: true,
            wallet: { select: { balance: true } },
          },
        },
        admin: { select: { id: true, name: true, username: true } },
        _count: { select: { unlockRecords: true } },
      },
    });
    return ok(requests);
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Aprobar / rechazar (admin) — fórmula System adminAceptarSolicitud
// ============================================================

export async function approveUnlockRequestAction(input: { requestId: string; action: "approve" | "reject"; observation?: string }): Promise<Result<{ requestCode: string; montoTotal: number }>> {
  try {
    const actor = await requirePermission("desbloqueos.write");
    const persisted = await getPersistedCurrentUser();
    if (persisted?.roleCode !== "ADMIN") return { success: false, error: "Solo el administrador puede aprobar solicitudes de desbloqueo." };

    const parsed = z.object({
      requestId: z.string().min(1),
      action: z.enum(["approve", "reject"]),
      observation: z.string().trim().max(1000).optional(),
    }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos inválidos." };
    const { requestId, action, observation } = parsed.data;

    const result = await prisma.$transaction(async (tx): Promise<{ requestCode: string; montoTotal: number }> => {
      const request = await tx.unlockRequest.findUnique({
        where: { id: requestId },
        include: { technician: { select: { id: true, name: true, username: true } } },
      });
      if (!request) throw new Error("Solicitud no encontrada");
      if (request.status !== "PENDING_ADMIN") throw new Error("Esta solicitud ya fue procesada.");

      if (action === "reject") {
        await tx.unlockRequest.update({
          where: { id: requestId },
          data: { status: "REJECTED", adminId: actor.id, adminObservation: observation || "Rechazado por el administrador" },
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "unlock.request.reject",
            module: "desbloqueos",
            entityType: "UnlockRequest",
            entityId: request.id,
            afterData: { requestCode: request.requestCode, observation: observation || null },
          },
        });
        return { requestCode: request.requestCode, montoTotal: 0 };
      }

      // ===== Aprobar: pagar RD$25 × IMEI al wallet del técnico =====
      const imeisActuales = (request.imeis as Array<{ imei: string; estado?: string }>) || [];
      const imeisAcreditar = imeisActuales.map((x) => x.imei).filter(Boolean);
      const cantidad = imeisAcreditar.length;
      if (cantidad === 0) throw new Error("No hay IMEIs válidos para pagar");

      const montoTotal = cantidad * UNLOCK_RATE;

      // Idempotencia: una solicitud paga una sola vez
      const externalKey = `unlock-payment:${request.id}:${request.technicianId}`;
      const existingPayment = await tx.walletLedgerEntry.findUnique({ where: { externalKey } });
      if (existingPayment) throw new Error("Esta solicitud ya fue pagada.");

      // Wallet del técnico (se crea si no existe)
      let wallet = await tx.wallet.findUnique({
        where: { userId: request.technicianId },
        include: { accounts: { where: { kind: "PRIMARY" } } },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: request.technicianId, balance: 0 },
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
          description: `Pago por Desbloqueos: ${request.requestCode} (${cantidad} equipo(s) × RD$${UNLOCK_RATE})`,
          externalKey,
          actorId: actor.id,
        },
      });
      await tx.walletAccount.update({ where: { id: account.id }, data: { balance: { increment: montoTotal } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: montoTotal } } });

      // Persistir cada IMEI en unlock_record (auditoría + anti-doble-pago futuro)
      const now = new Date();
      await tx.unlockRecord.createMany({
        data: imeisAcreditar.map((imei) => ({
          imei,
          model: request.model,
          requestId: request.id,
          technicianId: request.technicianId,
          adminId: actor.id,
          createdAt: now,
          paidAt: now,
        })),
      });

      // Cerrar la solicitud
      await tx.unlockRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          adminId: actor.id,
          adminObservation: observation || null,
          montoTotalPagado: montoTotal,
          approvedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "unlock.request.approve_pay",
          module: "desbloqueos",
          entityType: "UnlockRequest",
          entityId: request.id,
          afterData: { requestCode: request.requestCode, cantidad, montoPorEquipo: UNLOCK_RATE, montoTotal, externalKey, date: santoDomingoDateString() },
        },
      });

      return { requestCode: request.requestCode, montoTotal };
    });

    return ok(result);
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  } finally {
    revalidatePath("/desbloqueos");
    revalidatePath("/desbloqueos/pagos");
    revalidatePath("/wallet");
    revalidatePath("/dashboard");
  }
}

// ============================================================
// Historial por IMEI (admin) — fórmula System buscarUnlockPorImei
// ============================================================

export async function searchUnlockRecordAction(imei: string): Promise<Result<unknown | null>> {
  try {
    await requirePermission("desbloqueos.read");
    const imeiLimpio = imei.trim();
    if (!imeiLimpio) return { success: false, error: "IMEI vacío" };

    const record = await prisma.unlockRecord.findUnique({
      where: { imei: imeiLimpio },
      include: {
        technician: { select: { id: true, name: true, username: true } },
        admin: { select: { id: true, name: true, username: true } },
        request: { select: { id: true, requestCode: true, model: true } },
      },
    });
    return ok(record);
  } catch (error) {
    return fail(error);
  }
}

// ============================================================
// Stats del dashboard (admin: pendientes; técnico: resumen propio)
// ============================================================

export async function getUnlockDashboardAction(): Promise<Result<{
  isAdmin: boolean;
  pendingCount: number;
  myRequests: unknown[];
  totalPagado: number;
  saldoWallet: number;
}>> {
  try {
    await requirePermission("desbloqueos.read");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };

    if (persisted.roleCode === "ADMIN") {
      const pendingCount = await prisma.unlockRequest.count({ where: { status: "PENDING_ADMIN" } });
      return ok({ isAdmin: true, pendingCount, myRequests: [], totalPagado: 0, saldoWallet: 0 });
    }

    const [myRequests, wallet, totalAgg] = await Promise.all([
      prisma.unlockRequest.findMany({
        where: { technicianId: persisted.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { admin: { select: { name: true } } },
      }),
      prisma.wallet.findUnique({ where: { userId: persisted.id }, select: { balance: true } }),
      prisma.unlockRequest.aggregate({
        where: { technicianId: persisted.id, status: "APPROVED" },
        _sum: { montoTotalPagado: true },
      }),
    ]);

    return ok({
      isAdmin: false,
      pendingCount: 0,
      myRequests,
      totalPagado: Number(totalAgg._sum.montoTotalPagado ?? 0),
      saldoWallet: Number(wallet?.balance ?? 0),
    });
  } catch (error) {
    return fail(error);
  }
}
