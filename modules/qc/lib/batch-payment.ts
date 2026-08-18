import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const QC_REVIEW_RATE = 50; // RD$ por equipo revisado (fórmula SDigitalSystem, TARIFA_FALLBACK)

/**
 * Paga a los revisores de un lote cuando queda COMPLETED (entregado).
 * Fórmula SDigitalSystem (approveLote): N equipos revisados × RD$50,
 * acreditado al wallet del revisor que hizo la inspección más reciente
 * de cada equipo. Idempotente: cada pago tiene externalKey único
 * `qc-payment:{batchId}:{reviewerId}`.
 */
export async function payReviewersForBatch(
  batchId: string,
  tx: Prisma.TransactionClient = prisma,
  onlyReviewerId?: string,
) {
  const batch = await tx.qcRevisionBatch.findUnique({
    where: { id: batchId },
    select: { id: true, batchNumber: true, createdAt: true },
  });
  if (!batch) return 0;

  // Contar la inspección MÁS RECIENTE DE ESTE LOTE de cada equipo (igual que
  // los contadores del lote: una re-revisión reemplaza, no suma). Solo pagan
  // las revisiones hechas en este lote (createdAt >= lote.createdAt) — el
  // historial previo de un reingreso NO cuenta. El resultado no importa:
  // funcional o no funcional, la revisión se paga igual.
  const devices = await tx.deviceUnit.findMany({
    where: { batchId: batch.id, ...(onlyReviewerId ? { assignedToId: onlyReviewerId } : {}) },
    select: {
      inspections: {
        where: { createdAt: { gte: batch.createdAt } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { reviewerId: true, status: true },
      },
    },
  });

  const perReviewer = new Map<string, number>();
  for (const d of devices) {
    const last = d.inspections[0];
    if (last && last.status === "COMPLETED" && last.reviewerId) {
      perReviewer.set(last.reviewerId, (perReviewer.get(last.reviewerId) ?? 0) + 1);
    }
  }

  let paidReviewers = 0;
  for (const [reviewerId, count] of perReviewer) {
    const externalKey = `qc-payment:${batch.id}:${reviewerId}`;
    const existing = await tx.walletLedgerEntry.findUnique({ where: { externalKey } });
    if (existing) continue; // ya pagado (idempotente)

    const amount = count * QC_REVIEW_RATE;

    let wallet = await tx.wallet.findUnique({
      where: { userId: reviewerId },
      include: { accounts: { where: { kind: "PRIMARY" } } },
    });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId: reviewerId, balance: 0 },
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
        amount,
        description: `Pago por Lote QC: ${batch.batchNumber} (${count} equipo(s) × RD$${QC_REVIEW_RATE})`,
        externalKey,
        actorId: reviewerId,
        // OJO: NO usar batch_id aquí — el FK wallet_ledger_entry_batch_id_fkey
        // apunta a legacy_migration_batch, no a qc_revision_batch. El lote QC
        // queda trazado en externalKey (`qc-payment:{batchId}:{reviewerId}`)
        // y en description (batchNumber).
      },
    });
    await tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: { increment: amount } },
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    paidReviewers++;
  }

  return paidReviewers;
}
