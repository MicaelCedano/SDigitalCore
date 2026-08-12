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
    return ok({ amount: adjustedAmount, requestedAmount: amount, adjusted: adjustedAmount !== amount, baucherCode, newBalance: result.newBalance });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}
