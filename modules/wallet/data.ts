import { prisma } from "@/lib/db/prisma";
import { getPersistedCurrentUser, requirePermission, requireUser } from "@/lib/auth/helpers";

export async function getLegacyMigrationDashboard() {
  await requirePermission("settings.read");
  const persisted = await getPersistedCurrentUser();
  if (!persisted || persisted.status !== "ACTIVE" || persisted.roleCode !== "ADMIN") {
    throw new Error("Esta vista requiere el rol ADMIN.");
  }

  try {
    const [identities, users, batches] = await Promise.all([
      prisma.legacyUserIdentity.findMany({
        include: {
          coreUser: { select: { id: true, name: true, username: true, email: true } },
          archivedAccounts: { select: { typeSnapshot: true } },
        },
        orderBy: [{ matchStatus: "asc" }, { usernameSnapshot: "asc" }],
      }),
      prisma.user.findMany({
        where: { status: { in: ["ACTIVE", "INACTIVE"] } },
        select: { id: true, name: true, username: true, email: true, roleCode: true },
        orderBy: { name: "asc" },
      }),
      prisma.legacyMigrationBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    return {
      schemaReady: true as const,
      identities: identities.map((identity) => ({
        id: identity.id,
        sourceUserId: identity.sourceUserId,
        username: identity.usernameSnapshot,
        name: identity.nameSnapshot,
        email: identity.emailSnapshot,
        role: identity.roleSnapshot,
        walletEligible: ["qc", "control_calidad"].includes(identity.roleSnapshot?.trim().toLocaleLowerCase("es").replaceAll("-", "_").replaceAll(" ", "_") ?? ""),
        active: identity.activeSnapshot,
        balance: identity.sourceWalletBalance.toFixed(2),
        transactionCount: identity.sourceTransactionCount,
        accountCount: identity.archivedAccounts.length,
        savingsAccountCount: identity.archivedAccounts.filter((account) => account.typeSnapshot?.trim().toLocaleLowerCase("es") === "ahorro").length,
        status: identity.matchStatus,
        method: identity.matchMethod,
        coreUser: identity.coreUser,
      })),
      users,
      batches: batches.map((batch) => ({
        id: batch.id,
        mode: batch.mode,
        status: batch.status,
        sourceUserCount: batch.sourceUserCount,
        sourceAccountCount: batch.sourceAccountCount,
        sourceTransactionCount: batch.sourceTransactionCount,
        sourceBalanceTotal: batch.sourceBalanceTotal.toFixed(2),
        transferredUserCount: batch.transferredUserCount,
        transferredBalanceTotal: batch.transferredBalanceTotal.toFixed(2),
        createdAt: batch.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof Error && /legacy_(user_identity|migration_batch)|does not exist|P2021/i.test(error.message)) {
      return { schemaReady: false as const, identities: [], users: [], batches: [] };
    }
    throw error;
  }
}

export async function getCurrentWallet() {
  const sessionUser = await requireUser();
  await requirePermission("wallet.read");
  if (!sessionUser.id) throw new Error("La sesión no tiene un usuario persistido.");

  try {
    const [wallet, identity] = await Promise.all([
      prisma.wallet.findUnique({
        where: { userId: sessionUser.id },
        include: {
          accounts: { orderBy: [{ kind: "asc" }, { createdAt: "asc" }] },
          entries: {
            where: { status: "POSTED" },
            include: { account: { select: { name: true } } },
            orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
            take: 100,
          },
          user: { select: { name: true, username: true } },
        },
      }),
      prisma.legacyUserIdentity.findFirst({
        where: { coreUserId: sessionUser.id },
        include: { archivedTransactions: { orderBy: [{ occurredAt: "desc" }, { importedAt: "desc" }], take: 100 } },
      }),
    ]);
    return {
      schemaReady: true as const,
      wallet: wallet ? {
        currency: wallet.currency,
        balance: wallet.balance.toFixed(2),
        status: wallet.status,
        owner: wallet.user.name ?? wallet.user.username ?? "Usuario",
        accounts: wallet.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          kind: account.kind,
          balance: account.balance.toFixed(2),
          savingsGoal: account.savingsGoal?.toFixed(2) ?? null,
          color: account.color,
        })),
        entries: wallet.entries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount.toFixed(2),
          description: entry.description,
          accountName: entry.account.name,
          occurredAt: entry.occurredAt.toISOString(),
        })),
      } : null,
      legacyHistory: identity?.archivedTransactions.map((entry) => ({
        id: entry.id,
        type: entry.typeSnapshot,
        status: entry.statusSnapshot,
        amount: entry.amount.toFixed(2),
        description: entry.descriptionSnapshot,
        occurredAt: entry.occurredAt?.toISOString() ?? null,
        redeemed: entry.redeemedSnapshot,
      })) ?? [],
    };
  } catch (error) {
    if (error instanceof Error && /wallet|does not exist|P2021/i.test(error.message)) {
      return { schemaReady: false as const, wallet: null, legacyHistory: [] };
    }
    throw error;
  }
}
