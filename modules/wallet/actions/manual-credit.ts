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

/** Revierte un pago QC acreditado por error a una cuenta ADMIN, sin borrar evidencia. */
export async function reverseAdminQcPayment(input: unknown) {
  try {
    const actor = await getPersistedCurrentUser();
    if (!actor || actor.status !== "ACTIVE" || actor.roleCode !== "ADMIN") return { success: false, error: "Solo un administrador activo puede revertir este pago." };
    const parsed = z.object({ entryId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Movimiento inválido." };
    await prisma.$transaction(async (tx) => {
      const entry = await tx.walletLedgerEntry.findUnique({ where: { id: parsed.data.entryId }, include: { wallet: { include: { user: { select: { roleCode: true } } } } } });
      if (!entry || entry.type !== "CREDIT" || entry.status === "VOID" || !entry.externalKey.startsWith("qc-payment:")) throw new Error("Solo se puede revertir un pago QC válido.");
      if (entry.wallet.user.roleCode !== "ADMIN") throw new Error("Este movimiento no pertenece a una cuenta ADMIN.");
      await tx.walletAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: entry.amount } } });
      await tx.wallet.update({ where: { id: entry.walletId }, data: { balance: { decrement: entry.amount } } });
      await tx.walletLedgerEntry.create({ data: { walletId: entry.walletId, accountId: entry.accountId, type: "DEBIT", amount: entry.amount, description: `Reversión de pago QC acreditado por error: ${entry.description ?? ""}`, externalKey: `qc-payment-reversal:${entry.id}:${randomUUID()}`, reversalOfId: entry.id, actorId: actor.id } });
      await tx.walletLedgerEntry.update({ where: { id: entry.id }, data: { status: "VOID" } });
    });
    await logAudit({ userId: actor.id, action: "wallet.qc_payment.reverse_admin_credit", module: "wallet", entityType: "WalletLedgerEntry", entityId: parsed.data.entryId, afterData: { reason: "Cuenta ADMIN no pagable por revisiones QC" } });
    revalidatePath("/wallet");
    revalidatePath("/dashboard");
    return { success: true, message: "Pago QC revertido y registrado en auditoría." };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo revertir el pago." }; }
}

/** Corrige el caso histórico de un pago QC dividido entre ADMIN y su revisor. */
export async function correctSplitQcPayment(input: unknown) {
  try {
    const actor = await getPersistedCurrentUser();
    if (!actor || actor.status !== "ACTIVE" || actor.roleCode !== "ADMIN") return { success: false, error: "Solo un administrador activo puede corregir pagos." };
    const parsed = z.object({ adminEntryId: z.string().min(1), recipientUserId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos de corrección inválidos." };
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.walletLedgerEntry.findUnique({ where: { id: parsed.data.adminEntryId }, include: { wallet: { include: { user: { select: { roleCode: true } } } } } });
      const recipient = await tx.user.findUnique({ where: { id: parsed.data.recipientUserId }, select: { id: true, name: true, username: true, roleCode: true, status: true } });
      if (!entry || entry.type !== "CREDIT" || entry.status === "VOID" || !entry.externalKey.startsWith("qc-payment:")) throw new Error("El movimiento no es un pago QC válido.");
      if (entry.wallet.user.roleCode !== "ADMIN") throw new Error("El movimiento seleccionado no pertenece a ADMIN.");
      if (!recipient || recipient.roleCode === "ADMIN" || !["ACTIVE", "INACTIVE"].includes(recipient.status)) throw new Error("El destinatario no es un técnico válido.");
      const key = `qc-payment-correction:${entry.id}`;
      if (await tx.walletLedgerEntry.findUnique({ where: { externalKey: key } })) throw new Error("Este pago ya fue corregido.");
      let wallet = await tx.wallet.findUnique({ where: { userId: recipient.id }, include: { accounts: { where: { kind: "PRIMARY" } } } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId: recipient.id, balance: 0 }, include: { accounts: { where: { kind: "PRIMARY" } } } });
      let account = wallet.accounts[0];
      if (!account) account = await tx.walletAccount.create({ data: { walletId: wallet.id, name: "Principal", kind: "PRIMARY", balance: 0 } });
      await tx.walletAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: entry.amount } } });
      await tx.wallet.update({ where: { id: entry.walletId }, data: { balance: { decrement: entry.amount } } });
      await tx.walletLedgerEntry.create({ data: { walletId: entry.walletId, accountId: entry.accountId, type: "DEBIT", amount: entry.amount, description: `Corrección: reversión del pago QC acreditado por error a ADMIN (${entry.description ?? ""})`, externalKey: `qc-payment-reversal:${entry.id}`, reversalOfId: entry.id, actorId: actor.id } });
      await tx.walletLedgerEntry.update({ where: { id: entry.id }, data: { status: "VOID" } });
      await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, accountId: account.id, type: "CREDIT", amount: entry.amount, description: `Corrección de pago QC LOT-122 transferida desde ADMIN`, externalKey: key, actorId: actor.id } });
      await tx.walletAccount.update({ where: { id: account.id }, data: { balance: { increment: entry.amount } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: entry.amount } } });
      return { amount: entry.amount.toString(), recipient: recipient.name ?? recipient.username ?? recipient.id };
    });
    await logAudit({ userId: actor.id, action: "wallet.qc_payment.correct_split", module: "wallet", entityType: "WalletLedgerEntry", entityId: parsed.data.adminEntryId, afterData: result });
    revalidatePath("/wallet"); revalidatePath("/dashboard");
    return { success: true, message: `Se transfirieron RD$${result.amount} a ${result.recipient} y se anuló el crédito ADMIN.` };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "No se pudo corregir el pago." }; }
}
