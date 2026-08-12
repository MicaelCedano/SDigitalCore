import type { Prisma } from "@prisma/client";

export const LEGACY_SOURCE_SYSTEM = "SDIGITALSYSTEM";
export const WALLET_MODULE_KEY = "wallet";

function accountKind(type: string | null, name: string) {
  const normalizedType = type?.trim().toLocaleLowerCase("es");
  const normalizedName = name.trim().toLocaleLowerCase("es");
  return normalizedType === "ahorro" || (normalizedType !== "corriente" && normalizedName !== "principal")
    ? "SAVINGS" as const
    : "PRIMARY" as const;
}

function isWalletEligibleLegacyRole(role: string | null) {
  const normalized = role?.trim().toLocaleLowerCase("es").replaceAll("-", "_").replaceAll(" ", "_");
  return ["qc", "control_calidad", "tecnico", "tecnico_garantias"].includes(normalized ?? "");
}

export async function linkLegacyIdentity(
  tx: Prisma.TransactionClient,
  input: { legacyIdentityId: string; coreUserId: string; actorId: string; method: string },
) {
  const identity = await tx.legacyUserIdentity.findUnique({
    where: { id: input.legacyIdentityId },
    include: { archivedAccounts: { orderBy: [{ createdAtSnapshot: "asc" }, { sourceAccountId: "asc" }] } },
  });
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

  const walletAccessGranted = isWalletEligibleLegacyRole(identity.roleSnapshot);
  const allowedModules = walletAccessGranted && !user.allowedModules.includes(WALLET_MODULE_KEY)
    ? [...user.allowedModules, WALLET_MODULE_KEY]
    : user.allowedModules;

  if (walletAccessGranted) {
    await tx.user.update({ where: { id: user.id }, data: { allowedModules } });
  }
  const wallet = walletAccessGranted ? await tx.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currency: "DOP", balance: 0 },
    update: {},
  }) : null;
  const completedCutover = walletAccessGranted ? await tx.legacyMigrationBatch.findFirst({
    where: { sourceSystem: identity.sourceSystem, mode: "CUTOVER", status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  }) : null;
  const archivedAccounts = identity.archivedAccounts.length ? identity.archivedAccounts : [{
    sourceSystem: identity.sourceSystem,
    sourceAccountId: `principal:${identity.sourceUserId}`,
    nameSnapshot: "Principal",
    typeSnapshot: "corriente",
    balanceSnapshot: identity.sourceWalletBalance,
    savingsGoalSnapshot: null,
    colorSnapshot: null,
    createdAtSnapshot: null,
  }];
  const archivedTotal = archivedAccounts.reduce(
    (total, account) => total.add(account.balanceSnapshot),
    identity.sourceWalletBalance.mul(0),
  );
  if (walletAccessGranted && !archivedTotal.equals(identity.sourceWalletBalance)) {
    throw new Error("La suma de las cuentas anteriores no coincide con el saldo de la wallet.");
  }
  if (wallet) {
    for (const archived of archivedAccounts) {
      const account = await tx.walletAccount.upsert({
        where: {
          sourceSystem_sourceAccountId: {
            sourceSystem: archived.sourceSystem,
            sourceAccountId: archived.sourceAccountId,
          },
        },
        create: {
          walletId: wallet.id,
          name: archived.nameSnapshot,
          kind: accountKind(archived.typeSnapshot, archived.nameSnapshot),
          balance: 0,
          savingsGoal: archived.savingsGoalSnapshot,
          color: archived.colorSnapshot,
          sourceSystem: archived.sourceSystem,
          sourceAccountId: archived.sourceAccountId,
          createdAt: archived.createdAtSnapshot ?? undefined,
        },
        update: {
          walletId: wallet.id,
          name: archived.nameSnapshot,
          kind: accountKind(archived.typeSnapshot, archived.nameSnapshot),
          savingsGoal: archived.savingsGoalSnapshot,
          color: archived.colorSnapshot,
        },
      });
      if (!completedCutover || archived.balanceSnapshot.isZero()) continue;
      const inserted = await tx.walletLedgerEntry.createMany({
        data: [{
          walletId: wallet.id,
          accountId: account.id,
          type: "LEGACY_OPENING_BALANCE",
          amount: archived.balanceSnapshot,
          description: `Saldo inicial migrado de ${identity.sourceSystem}: ${archived.nameSnapshot}`,
          externalKey: `${identity.sourceSystem}:opening:${identity.sourceUserId}:account:${archived.sourceAccountId}`,
          actorId: input.actorId,
          batchId: completedCutover.id,
        }],
        skipDuplicates: true,
      });
      if (inserted.count === 1) {
        await tx.walletAccount.update({
          where: { id: account.id },
          data: { balance: { increment: archived.balanceSnapshot } },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: archived.balanceSnapshot } },
        });
      }
    }
  }
  const linked = await tx.legacyUserIdentity.update({
    where: { id: identity.id },
    data: {
      coreUserId: user.id,
      linkedById: input.actorId,
      linkedAt: new Date(),
      matchMethod: walletAccessGranted ? input.method : `${input.method}_identity_only`,
      matchStatus: walletAccessGranted ? (completedCutover ? "TRANSFERRED" : "LINKED_PENDING_CUTOVER") : "EXCLUDED",
      transferredAt: completedCutover ? new Date() : null,
    },
  });
  return { identity: linked, user, walletAccessGranted };
}
