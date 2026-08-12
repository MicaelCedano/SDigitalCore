"use server";

import { z } from "zod";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = (error: unknown): Result<never> => {
  console.error("[wallet] Error en operación", error);
  return { success: false, error: "No se pudo completar la operación. Inténtalo nuevamente." };
};

/**
 * Solicitud de retiro (fórmula SDigitalSystem requestWithdrawal).
 * - El monto se ajusta al múltiplo de 100 hacia abajo (1135 → 1100).
 * - Mínimo RD$ 2,000.
 * - Debita de la cuenta Principal vía ledger DEBIT idempotente (externalKey único).
 * - Genera un código de baucher para el comprobante.
 */
export async function requestWithdrawalAction(input: unknown): Promise<Result<{
  amount: number;
  requestedAmount: number;
  adjusted: boolean;
  baucherCode: string;
  secureToken: string;
  newBalance: number;
}>> {
  try {
    const actor = await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };

    const parsed = z.object({ amount: z.number().finite().positive("El monto debe ser mayor a 0") }).safeParse(input);
    if (!parsed.success) return { success: false, error: "El monto debe ser mayor a 0" };
    const { amount } = parsed.data;

    // Ajuste a múltiplo de 100 (regla del baucher)
    const adjustedAmount = Math.floor(amount / 100) * 100;
    if (adjustedAmount < 2000) return { success: false, error: "El monto mínimo para retirar es RD$ 2,000" };

    const baucherCode = `BAUCHER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    // Token de seguridad unívoco (validador de System): 32 bytes hex
    const secureToken = crypto.randomBytes(32).toString("hex");

    const result = await prisma.$transaction(async (tx): Promise<{ newBalance: number }> => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: actor.id },
        include: { accounts: { where: { kind: "PRIMARY" }, take: 1 } },
      });
      if (!wallet) throw new Error("No se encontró el wallet del usuario.");
      const principal = wallet.accounts[0];
      if (!principal) throw new Error("No se encontró la cuenta Principal.");

      if (adjustedAmount > Number(principal.balance)) {
        throw new Error(`Saldo insuficiente en tu cuenta Principal.`);
      }

      const externalKey = `withdrawal:${actor.id}:${crypto.randomUUID()}`;
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          accountId: principal.id,
          type: "DEBIT",
          amount: adjustedAmount,
          description: `Retiro de efectivo ${baucherCode}`,
          externalKey,
          secureToken,
          actorId: actor.id,
        },
      });
      await tx.walletAccount.update({
        where: { id: principal.id },
        data: { balance: { decrement: adjustedAmount } },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: adjustedAmount } },
      });
      return { newBalance: Number(principal.balance) - adjustedAmount };
    });

    await logAudit({
      userId: actor.id,
      action: "wallet.withdrawal",
      module: "wallet",
      entityType: "WalletLedgerEntry",
      entityId: baucherCode,
      afterData: { amount: adjustedAmount, requestedAmount: amount, baucherCode, date: new Date().toISOString() },
    });

    revalidatePath("/wallet");
    return ok({ amount: adjustedAmount, requestedAmount: amount, adjusted: adjustedAmount !== amount, baucherCode, secureToken, newBalance: result.newBalance });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}

/**
 * Validador de bauchers (port de System /admin/pagos): lista los retiros
 * pendientes de canje — el técnico generó el baucher con su token de seguridad
 * y el admin lo marca como pagado cuando entrega el efectivo.
 * Solo los DEBIT tipo retiro sin canjear (redeemed_at NULL, status POSTED).
 */
export async function getPendingWithdrawalsAction(): Promise<Result<{
  pending: Array<{
    id: string;
    amount: number;
    baucherCode: string;
    secureToken: string;
    technicianName: string;
    technicianUsername: string;
    accountName: string;
    occurredAt: string;
  }>;
}>> {
  try {
    await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede validar retiros." };
    }

    const entries = await prisma.walletLedgerEntry.findMany({
      where: {
        type: "DEBIT",
        status: "POSTED",
        redeemedAt: null,
        secureToken: { not: null },
        description: { contains: "Retiro de efectivo" },
      },
      include: {
        actor: { select: { name: true, username: true } },
        account: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });

    return ok({
      pending: entries.map((entry) => ({
        id: entry.id,
        amount: Number(entry.amount),
        baucherCode: entry.description?.replace("Retiro de efectivo ", "") ?? "BAUCHER-?",
        secureToken: entry.secureToken ?? "",
        technicianName: entry.actor?.name ?? "Usuario",
        technicianUsername: entry.actor?.username ?? "",
        accountName: entry.account.name,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}

/**
 * Marca un retiro como canjeado/pagado (System markAsRedeemed).
 * Requiere el token de seguridad del baucher como confirmación del admin.
 */
export async function redeemWithdrawalAction(input: unknown): Promise<Result<{ id: string; redeemed: boolean }>> {
  try {
    await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede validar retiros." };
    }

    const parsed = z
      .object({ entryId: z.string().min(1), secureToken: z.string().min(8) })
      .safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos de validación inválidos." };
    const { entryId, secureToken } = parsed.data;

    const entry = await prisma.walletLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: "El retiro no existe." };
    if (entry.secureToken !== secureToken) {
      return { success: false, error: "El token de seguridad no coincide con el baucher." };
    }
    if (entry.redeemedAt) return { success: false, error: "Este baucher ya fue canjeado." };

    await prisma.walletLedgerEntry.update({
      where: { id: entry.id },
      data: { redeemedAt: new Date(), redeemedById: persisted.id },
    });

    await logAudit({
      userId: persisted.id,
      action: "wallet.withdrawal.redeem",
      module: "wallet",
      entityType: "WalletLedgerEntry",
      entityId: entry.id,
      afterData: { amount: Number(entry.amount), secureToken, date: new Date().toISOString() },
    });

    revalidatePath("/wallet");
    return ok({ id: entry.id, redeemed: true });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}

/**
 * Anula un retiro pendiente (System cancelWithdrawal): revierte el saldo
 * a la cuenta Principal y marca la entrada como VOID, sin borrarla (auditoría).
 */
export async function cancelWithdrawalAction(input: unknown): Promise<Result<{ id: string; cancelled: boolean }>> {
  try {
    await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede anular retiros." };
    }

    const parsed = z.object({ entryId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos de validación inválidos." };
    const { entryId } = parsed.data;

    await prisma.$transaction(async (tx): Promise<void> => {
      const entry = await tx.walletLedgerEntry.findUnique({
        where: { id: entryId },
        include: { wallet: true, account: true },
      });
      if (!entry) throw new Error("El retiro no existe.");
      if (entry.redeemedAt) throw new Error("Este baucher ya fue canjeado y no se puede anular.");
      if (entry.status === "VOID") throw new Error("Este retiro ya fue anulado.");

      // 1. Reversar el saldo a la cuenta y al wallet
      await tx.walletAccount.update({
        where: { id: entry.accountId },
        data: { balance: { increment: entry.amount } },
      });
      await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balance: { increment: entry.amount } },
      });

      // 2. Entrada espejo de reversa (CREDIT) con reversalOfId apuntando al DEBIT
      await tx.walletLedgerEntry.create({
        data: {
          walletId: entry.walletId,
          accountId: entry.accountId,
          type: "CREDIT",
          amount: entry.amount,
          description: `Anulación de ${entry.description}`,
          externalKey: `withdrawal-cancel:${persisted.id}:${crypto.randomUUID()}`,
          reversalOfId: entry.id,
          actorId: persisted.id,
        },
      });

      // 3. Marcar el DEBIT original como VOID (no se borra: auditoría)
      await tx.walletLedgerEntry.update({
        where: { id: entry.id },
        data: { status: "VOID" },
      });
    });

    await logAudit({
      userId: persisted.id,
      action: "wallet.withdrawal.cancel",
      module: "wallet",
      entityType: "WalletLedgerEntry",
      entityId: entryId,
      afterData: { date: new Date().toISOString() },
    });

    revalidatePath("/wallet");
    return ok({ id: entryId, cancelled: true });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}
