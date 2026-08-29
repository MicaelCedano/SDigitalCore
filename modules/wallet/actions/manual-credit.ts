"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";

const manualCreditSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().finite().positive().max(1_000_000),
  reason: z.string().trim().min(10).max(300),
  reference: z.string().trim().min(6).max(120).regex(/^[a-zA-Z0-9_-]+$/),
});

export async function createManualWalletCreditAction(input: unknown) {
  try {
    await requirePermission("wallet.read");
    const actor = await getPersistedCurrentUser();
    if (!actor || actor.status !== "ACTIVE" || actor.roleCode !== "ADMIN") {
      return { success: false, error: "Solo un administrador activo puede acreditar pagos manuales." };
    }

    const parsed = manualCreditSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Revisa el usuario, monto, motivo y referencia." };

    const { userId, amount, reason, reference } = parsed.data;
    const recipient = await prisma.user.findFirst({
      where: { id: userId, roleCode: { in: ["QC", "TECNICO"] }, status: { in: ["ACTIVE", "INACTIVE"] } },
      select: { id: true, name: true, username: true, email: true },
    });
    if (!recipient) return { success: false, error: "El destinatario no es un integrante válido de QC o técnico." };

    const externalKey = `manual-credit:${reference}`;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.walletLedgerEntry.findUnique({ where: { externalKey }, select: { id: true } });
      if (existing) throw new Error("Ya existe un crédito con esa referencia.");

      let wallet = await tx.wallet.findUnique({ where: { userId }, include: { accounts: { where: { kind: "PRIMARY" } } } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0 },
          include: { accounts: { where: { kind: "PRIMARY" } } },
        });
      }
      let account = wallet.accounts[0];
      if (!account) {
        account = await tx.walletAccount.create({ data: { walletId: wallet.id, name: "Principal", kind: "PRIMARY", balance: 0 } });
      }

      const decimalAmount = new Prisma.Decimal(amount.toFixed(2));
      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          accountId: account.id,
          type: "CREDIT",
          amount: decimalAmount,
          description: `Ingreso manual: ${reason}`,
          externalKey,
          actorId: actor.id,
        },
        select: { id: true, amount: true },
      });
      await tx.walletAccount.update({ where: { id: account.id }, data: { balance: { increment: decimalAmount } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: decimalAmount } } });
      return entry;
    });

    await logAudit({
      userId: actor.id,
      action: "wallet.manual_credit",
      module: "wallet",
      entityType: "WalletLedgerEntry",
      entityId: result.id,
      afterData: { recipientId: recipient.id, recipientName: recipient.name ?? recipient.username ?? recipient.email, amount: result.amount.toString(), reason, reference, externalKey },
    });
    revalidatePath("/wallet");
    revalidatePath("/dashboard");
    return { success: true, message: `Se acreditaron RD$${result.amount.toString()} a ${recipient.name ?? recipient.username ?? recipient.email}.` };
  } catch (error) {
    console.error("Error en crédito manual de wallet:", error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudo acreditar el pago manual." };
  }
}
