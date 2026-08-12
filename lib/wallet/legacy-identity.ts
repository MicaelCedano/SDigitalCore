import type { Prisma } from "@prisma/client";

export const LEGACY_SOURCE_SYSTEM = "SDIGITALSYSTEM";
export const WALLET_MODULE_KEY = "wallet";

export async function linkLegacyIdentity(
  tx: Prisma.TransactionClient,
  input: { legacyIdentityId: string; coreUserId: string; actorId: string; method: string },
) {
  const identity = await tx.legacyUserIdentity.findUnique({ where: { id: input.legacyIdentityId } });
  if (!identity) throw new Error("La identidad anterior no existe.");
  if (identity.sourceSystem !== LEGACY_SOURCE_SYSTEM) throw new Error("La fuente de identidad no es válida.");
  if (identity.matchStatus === "TRANSFERRED") throw new Error("Ese saldo ya fue transferido y no puede reenlazarse.");
  if (identity.coreUserId && identity.coreUserId !== input.coreUserId) {
    throw new Error("La identidad anterior ya está enlazada con otro usuario.");
  }

  const user = await tx.user.findUnique({ where: { id: input.coreUserId } });
  if (!user) throw new Error("El usuario nuevo no existe.");
  const occupied = await tx.legacyUserIdentity.findFirst({
    where: {
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      coreUserId: input.coreUserId,
      NOT: { id: input.legacyIdentityId },
    },
    select: { id: true },
  });
  if (occupied) throw new Error("Ese usuario nuevo ya está enlazado con otra identidad anterior.");

  const allowedModules = user.allowedModules.includes(WALLET_MODULE_KEY)
    ? user.allowedModules
    : [...user.allowedModules, WALLET_MODULE_KEY];

  await tx.user.update({ where: { id: user.id }, data: { allowedModules } });
  const wallet = await tx.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currency: "DOP", balance: 0 },
    update: {},
  });
  const completedCutover = await tx.legacyMigrationBatch.findFirst({
    where: { sourceSystem: identity.sourceSystem, mode: "CUTOVER", status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });
  if (completedCutover && !identity.sourceWalletBalance.isZero()) {
    await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: "LEGACY_OPENING_BALANCE",
        amount: identity.sourceWalletBalance,
        description: `Saldo inicial migrado de ${identity.sourceSystem}`,
        externalKey: `${identity.sourceSystem}:opening:${identity.sourceUserId}`,
        actorId: input.actorId,
        batchId: completedCutover.id,
      },
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: identity.sourceWalletBalance } },
    });
  }
  const linked = await tx.legacyUserIdentity.update({
    where: { id: identity.id },
    data: {
      coreUserId: user.id,
      linkedById: input.actorId,
      linkedAt: new Date(),
      matchMethod: input.method,
      matchStatus: completedCutover ? "TRANSFERRED" : "LINKED_PENDING_CUTOVER",
      transferredAt: completedCutover ? new Date() : null,
    },
  });
  return { identity: linked, user };
}
