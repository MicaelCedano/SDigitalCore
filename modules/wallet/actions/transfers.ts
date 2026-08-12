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
  console.error("[wallet] Error en transferencia", error);
  return { success: false, error: "No se pudo completar la transferencia. Inténtalo nuevamente." };
};

/**
 * Transferencia interna entre cuentas del wallet (fórmula SDigitalSystem:
 * "Transferencia interna: mi cualto -> Principal").
 * - Mueve saldo de una cuenta a otra del MISMO wallet (Principal ↔ Ahorro).
 * - Ledger: DEBIT en origen + CREDIT en destino, externalKeys idempotentes
 *   compartiendo el mismo UUID (re-intento no duplica).
 * - El balance total del wallet NO cambia (es un movimiento interno).
 */
export async function transferBetweenAccountsAction(input: unknown): Promise<Result<{
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fromBalance: number;
  toBalance: number;
}>> {
  try {
    const actor = await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };

    const parsed = z
      .object({
        fromAccountId: z.string().min(1),
        toAccountId: z.string().min(1),
        amount: z.number().finite().positive("El monto debe ser mayor a 0"),
      })
      .safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos de transferencia inválidos." };
    const { fromAccountId, toAccountId, amount } = parsed.data;

    if (fromAccountId === toAccountId) {
      return { success: false, error: "La cuenta de origen y destino deben ser diferentes." };
    }

    const result = await prisma.$transaction(async (tx): Promise<{ fromBalance: number; toBalance: number }> => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: actor.id },
        include: { accounts: true },
      });
      if (!wallet) throw new Error("No se encontró el wallet del usuario.");

      const from = wallet.accounts.find((account) => account.id === fromAccountId);
      const to = wallet.accounts.find((account) => account.id === toAccountId);
      if (!from) throw new Error("La cuenta de origen no pertenece a tu wallet.");
      if (!to) throw new Error("La cuenta de destino no pertenece a tu wallet.");

      if (amount > Number(from.balance)) {
        throw new Error(`Saldo insuficiente en "${from.name}" (${new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(from.balance))}).`);
      }

      const transferUuid = crypto.randomUUID();
      const sharedKey = `transfer:${actor.id}:${transferUuid}`;

      // DEBIT en origen
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          accountId: from.id,
          type: "DEBIT",
          amount,
          description: `Transferencia interna: ${from.name} → ${to.name}`,
          externalKey: `${sharedKey}:from`,
          actorId: actor.id,
        },
      });
      // CREDIT en destino
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          accountId: to.id,
          type: "CREDIT",
          amount,
          description: `Transferencia interna: ${from.name} → ${to.name}`,
          externalKey: `${sharedKey}:to`,
          actorId: actor.id,
        },
      });

      await tx.walletAccount.update({
        where: { id: from.id },
        data: { balance: { decrement: amount } },
      });
      await tx.walletAccount.update({
        where: { id: to.id },
        data: { balance: { increment: amount } },
      });
      // wallet.balance no se toca: es una transferencia interna

      return { fromBalance: Number(from.balance) - amount, toBalance: Number(to.balance) + amount };
    });

    await logAudit({
      userId: actor.id,
      action: "wallet.transfer",
      module: "wallet",
      entityType: "WalletLedgerEntry",
      entityId: `${fromAccountId}:${toAccountId}`,
      afterData: { fromAccountId, toAccountId, amount, date: new Date().toISOString() },
    });

    revalidatePath("/wallet");
    return ok({ fromAccountId, toAccountId, amount, fromBalance: result.fromBalance, toBalance: result.toBalance });
  } catch (error) {
    if (error instanceof Error) return { success: false, error: error.message };
    return fail(error);
  }
}
