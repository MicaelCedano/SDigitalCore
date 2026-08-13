"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T; message?: string } | { success: false; error: string };

/**
 * Penalidades — port de SDigitalSystem (admin-payments.ts):
 * - INTERNA: se busca el equipo por IMEI y se penaliza al último QC que lo revisó.
 * - EXTERNA: el admin señala al culpable directamente (IMEI/modelo libres).
 * El descuento es un DEBIT en el wallet (sin secureToken, para que NO aparezca
 * en el validador de retiros) + registro en `penalty` con su ledger_entry_id.
 * Revertir crea la entrada espejo CREDIT y marca la penalidad REVERSED (no se
 * borra: auditoría).
 */

const imeiSearchSchema = z.object({ imei: z.string().trim().min(1).max(20) });
const penaltyByImeiSchema = z.object({
  imei: z.string().trim().min(1).max(20),
  motivo: z.string().trim().min(3).max(300),
  monto: z.number().positive().max(100000),
});
const externalPenaltySchema = z.object({
  technicianId: z.string().min(1),
  imei: z.string().trim().min(1).max(20),
  modelo: z.string().trim().max(200).optional(),
  monto: z.number().positive().max(100000),
  motivo: z.string().trim().min(3).max(300),
});
const revertSchema = z.object({ id: z.string().min(1) });

const PENALTY_REVALIDATE = ["/qc/penalidades", "/qc", "/wallet", "/dashboard"];

async function requirePenaltyAdmin() {
  const actor = await requirePermission("qc.write");
  const persisted = await getPersistedCurrentUser();
  if (!persisted || persisted.roleCode !== "ADMIN") {
    throw new Error("Solo el administrador puede gestionar penalidades.");
  }
  return { actor, persisted };
}

/** Último revisor QC del equipo (última inspección COMPLETED con revisor). */
function lastReviewerSelect() {
  return {
    id: true,
    imei: true,
    brand: true,
    model: true,
    inspections: {
      where: { status: "COMPLETED", reviewerId: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take: 1,
      select: {
        reviewerId: true,
        result: true,
        grade: true,
        reviewedAt: true,
        functionalityNotes: true,
        reviewer: { select: { id: true, name: true, username: true } },
      },
    },
  } satisfies Prisma.DeviceUnitSelect;
}

/** Busca (o crea) el wallet + cuenta PRIMARY del usuario, listos para debitar. */
async function ensurePrimaryAccount(tx: Prisma.TransactionClient, userId: string) {
  let wallet = await tx.wallet.findUnique({
    where: { userId },
    include: { accounts: { where: { kind: "PRIMARY" } } },
  });
  if (!wallet) {
    wallet = await tx.wallet.create({
      data: { userId, balance: 0 },
      include: { accounts: { where: { kind: "PRIMARY" } } },
    });
  }
  let account = wallet.accounts[0];
  if (!account) {
    account = await tx.walletAccount.create({
      data: { walletId: wallet.id, name: "Principal", kind: "PRIMARY", balance: 0 },
    });
  }
  return { walletId: wallet.id, accountId: account.id };
}

/**
 * Búsqueda previa por IMEI (read-only): muestra el equipo y el último QC que lo
 * revisó, para confirmar antes de penalizar. Si no hay revisor (equipo legacy
 * migrado sin revisor), se sugiere usar una penalidad externa.
 */
export async function getPenaltyDataByImeiAction(input: z.input<typeof imeiSearchSchema>): Promise<Result<{
  device: { id: string; imei: string | null; brand: string | null; model: string };
  reviewer: { id: string; name: string | null; username: string | null } | null;
  lastReview: { result: string | null; grade: string | null; reviewedAt: Date | null; functionalityNotes: string | null } | null;
}>> {
  try {
    await requirePenaltyAdmin();
    const { imei } = imeiSearchSchema.parse(input);

    const device = await prisma.deviceUnit.findFirst({
      where: { imei },
      select: lastReviewerSelect(),
    });
    if (!device) return { success: false, error: "No se encontró un equipo con ese IMEI." };

    const last = device.inspections[0];
    const reviewer = last?.reviewer ?? null;
    return {
      success: true,
      data: {
        device: { id: device.id, imei: device.imei, brand: device.brand, model: device.model },
        reviewer: reviewer ? { id: reviewer.id, name: reviewer.name, username: reviewer.username } : null,
        lastReview: last
          ? { result: last.result, grade: last.grade, reviewedAt: last.reviewedAt, functionalityNotes: last.functionalityNotes }
          : null,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo buscar el IMEI." };
  }
}

/**
 * Penalidad INTERNA: penaliza al último QC que revisó el equipo (IMEI).
 * Descuenta el monto del wallet del revisor y registra el asiento DEBIT.
 */
export async function applyPenaltyByImeiAction(input: z.input<typeof penaltyByImeiSchema>): Promise<Result<{ penaltyId: string; technician: string }>> {
  try {
    const { persisted } = await requirePenaltyAdmin();
    const data = penaltyByImeiSchema.parse(input);

    const penalty = await prisma.$transaction(async (tx) => {
      const device = await tx.deviceUnit.findFirst({
        where: { imei: data.imei },
        select: lastReviewerSelect(),
      });
      if (!device) throw new Error("No se encontró un equipo con ese IMEI.");
      const reviewer = device.inspections[0]?.reviewer;
      if (!reviewer) {
        throw new Error(
          "Ese equipo no tiene una revisión de QC con revisor registrado (puede ser un equipo legacy migrado). Usa una penalidad externa eligiendo al culpable.",
        );
      }

      const { walletId, accountId } = await ensurePrimaryAccount(tx, reviewer.id);
      const externalKey = `penalty:internal:${device.id}:${crypto.randomUUID()}`;
      const description = `PENALIDAD: ${data.motivo} (IMEI: ${data.imei})`;

      // DEBIT sin secureToken: la penalidad NO es un retiro canjeable.
      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId,
          accountId,
          type: "DEBIT",
          amount: data.monto,
          description,
          externalKey,
          actorId: persisted.id,
        },
      });
      await tx.walletAccount.update({ where: { id: accountId }, data: { balance: { decrement: data.monto } } });
      await tx.wallet.update({ where: { id: walletId }, data: { balance: { decrement: data.monto } } });

      const record = await tx.penalty.create({
        data: {
          type: "INTERNAL",
          deviceImei: data.imei,
          deviceModel: device.model,
          deviceId: device.id,
          technicianId: reviewer.id,
          motivo: data.motivo,
          monto: data.monto,
          adminId: persisted.id,
          ledgerEntryId: entry.id,
        },
      });
      return { record, technicianName: reviewer.name ?? reviewer.username ?? "QC" };
    });

    await logAudit({
      userId: persisted.id,
      action: "penalty.apply_internal",
      module: "qc",
      entityType: "penalty",
      entityId: penalty.record.id,
      afterData: {
        imei: data.imei,
        technicianId: penalty.record.technicianId,
        monto: Number(penalty.record.monto),
        motivo: data.motivo,
      },
    });

    for (const path of PENALTY_REVALIDATE) revalidatePath(path);
    return { success: true, data: { penaltyId: penalty.record.id, technician: penalty.technicianName }, message: `Penalidad aplicada a ${penalty.technicianName}.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo aplicar la penalidad." };
  }
}

/**
 * Penalidad EXTERNA: el admin elige al culpable y registra IMEI/modelo libres.
 */
export async function applyExternalPenaltyAction(input: z.input<typeof externalPenaltySchema>): Promise<Result<{ penaltyId: string }>> {
  try {
    const { persisted } = await requirePenaltyAdmin();
    const data = externalPenaltySchema.parse(input);

    const penalty = await prisma.$transaction(async (tx) => {
      const technician = await tx.user.findUnique({ where: { id: data.technicianId } });
      if (!technician) throw new Error("El técnico seleccionado no existe.");

      const { walletId, accountId } = await ensurePrimaryAccount(tx, technician.id);
      const externalKey = `penalty:external:${crypto.randomUUID()}`;
      const description = `PENALIDAD EXTERNA: ${data.motivo} (IMEI: ${data.imei})`;

      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId,
          accountId,
          type: "DEBIT",
          amount: data.monto,
          description,
          externalKey,
          actorId: persisted.id,
        },
      });
      await tx.walletAccount.update({ where: { id: accountId }, data: { balance: { decrement: data.monto } } });
      await tx.wallet.update({ where: { id: walletId }, data: { balance: { decrement: data.monto } } });

      const record = await tx.penalty.create({
        data: {
          type: "EXTERNAL",
          deviceImei: data.imei,
          deviceModel: data.modelo || null,
          technicianId: technician.id,
          motivo: data.motivo,
          monto: data.monto,
          adminId: persisted.id,
          ledgerEntryId: entry.id,
        },
      });
      return { record, technicianName: technician.name ?? technician.username ?? "Técnico" };
    });

    await logAudit({
      userId: persisted.id,
      action: "penalty.apply_external",
      module: "qc",
      entityType: "penalty",
      entityId: penalty.record.id,
      afterData: {
        imei: data.imei,
        modelo: data.modelo || null,
        technicianId: penalty.record.technicianId,
        monto: Number(penalty.record.monto),
        motivo: data.motivo,
      },
    });

    for (const path of PENALTY_REVALIDATE) revalidatePath(path);
    return { success: true, data: { penaltyId: penalty.record.id }, message: `Penalidad externa aplicada a ${penalty.technicianName}.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo aplicar la penalidad externa." };
  }
}

/**
 * Revierte una penalidad ACTIVE: devuelve el saldo (entrada espejo CREDIT con
 * reversalOfId), marca el DEBIT original VOID y la penalidad REVERSED.
 */
export async function revertPenaltyAction(input: z.input<typeof revertSchema>): Promise<Result<{ penaltyId: string }>> {
  try {
    const { persisted } = await requirePenaltyAdmin();
    const { id } = revertSchema.parse(input);

    const penalty = await prisma.$transaction(async (tx) => {
      const record = await tx.penalty.findUnique({
        where: { id },
        include: { ledgerEntry: true, technician: { select: { name: true, username: true } } },
      });
      if (!record) throw new Error("Penalidad no encontrada.");
      if (record.status !== "ACTIVE") throw new Error("Esta penalidad ya fue revertida.");
      if (record.sourceSystem) {
        throw new Error(
          "Esta penalidad es histórica de SDigitalSystem: su descuento ya está incluido en el saldo migrado y no se puede revertir desde Core.",
        );
      }
      if (!record.ledgerEntry) throw new Error("La penalidad no tiene asiento de wallet asociado.");
      if (record.ledgerEntry.status === "VOID") throw new Error("El asiento de la penalidad ya fue anulado.");

      const entry = record.ledgerEntry;
      await tx.walletAccount.update({
        where: { id: entry.accountId },
        data: { balance: { increment: record.monto } },
      });
      await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balance: { increment: record.monto } },
      });
      await tx.walletLedgerEntry.create({
        data: {
          walletId: entry.walletId,
          accountId: entry.accountId,
          type: "CREDIT",
          amount: record.monto,
          description: `Reversión de penalidad: ${record.motivo}`,
          externalKey: `penalty-reversal:${record.id}`,
          reversalOfId: entry.id,
          actorId: persisted.id,
        },
      });
      await tx.walletLedgerEntry.update({
        where: { id: entry.id },
        data: { status: "VOID" },
      });
      const updated = await tx.penalty.update({
        where: { id: record.id },
        data: { status: "REVERSED" },
      });
      return { updated, technicianName: record.technician.name ?? record.technician.username ?? "Técnico" };
    });

    await logAudit({
      userId: persisted.id,
      action: "penalty.revert",
      module: "qc",
      entityType: "penalty",
      entityId: penalty.updated.id,
      afterData: { monto: Number(penalty.updated.monto), motivo: penalty.updated.motivo },
    });

    for (const path of PENALTY_REVALIDATE) revalidatePath(path);
    return { success: true, data: { penaltyId: penalty.updated.id }, message: `Penalidad revertida; saldo devuelto a ${penalty.technicianName}.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo revertir la penalidad." };
  }
}

/**
 * Historial + resumen + % de penalidades por técnico (fórmula System:
 * % = penalidades ACTIVE / inspecciones COMPLETED del revisor).
 */
export async function getPenaltiesAction(): Promise<
  Result<{
    summary: { total: number; active: number; internalCount: number; externalCount: number; activeTotal: number };
    penalties: Array<{
      id: string;
      type: string;
      status: string;
      monto: number;
      motivo: string;
      deviceImei: string | null;
      deviceModel: string | null;
      createdAt: Date;
      technician: { name: string | null; username: string | null };
      admin: { name: string | null; username: string | null };
    }>;
    technicians: Array<{
      id: string;
      name: string;
      username: string | null;
      roleCode: string;
      totalReviewed: number;
      totalPenalties: number;
      percentage: number;
    }>;
    techOptions: Array<{ id: string; name: string; username: string | null; roleCode: string }>;
  }>
> {
  try {
    await requirePenaltyAdmin();

    const [penalties, summary, techniciansRaw, techOptions] = await Promise.all([
      prisma.penalty.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          type: true,
          status: true,
          monto: true,
          motivo: true,
          deviceImei: true,
          deviceModel: true,
          sourceSystem: true,
          createdAt: true,
          technician: { select: { name: true, username: true } },
          admin: { select: { name: true, username: true } },
        },
      }),
      prisma.penalty.aggregate({
        where: { status: "ACTIVE" },
        _count: { id: true },
        _sum: { monto: true },
      }),
      prisma.user.findMany({
        where: { roleCode: { in: ["QC", "TECNICO"] }, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          username: true,
          roleCode: true,
          qcInspections: {
            where: { status: "COMPLETED" },
            select: { id: true },
          },
          penaltiesReceived: {
            where: { status: "ACTIVE", sourceSystem: null },
            select: { id: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { roleCode: { in: ["QC", "TECNICO"] }, status: "ACTIVE" },
        select: { id: true, name: true, username: true, roleCode: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const technicians = techniciansRaw
      .map((t) => {
        const totalReviewed = t.qcInspections.length;
        const totalPenalties = t.penaltiesReceived.length;
        const percentage = totalReviewed > 0 ? Number(((totalPenalties / totalReviewed) * 100).toFixed(2)) : 0;
        return {
          id: t.id,
          name: t.name ?? t.username ?? t.id,
          username: t.username,
          roleCode: t.roleCode,
          totalReviewed,
          totalPenalties,
          percentage,
        };
      })
      .filter((t) => t.totalReviewed > 0 || t.totalPenalties > 0)
      .sort((a, b) => b.percentage - a.percentage);

    const internalCount = penalties.filter((p) => p.type === "INTERNAL").length;
    const externalCount = penalties.filter((p) => p.type === "EXTERNAL").length;

    return {
      success: true,
      data: {
        summary: {
          total: penalties.length,
          active: summary._count.id,
          internalCount,
          externalCount,
          activeTotal: Number(summary._sum.monto ?? 0),
        },
        penalties: penalties.map((p) => ({ ...p, monto: Number(p.monto) })),
        technicians,
        techOptions: techOptions.map((t) => ({ ...t, name: t.name ?? t.username ?? t.id })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo cargar el historial de penalidades." };
  }
}
