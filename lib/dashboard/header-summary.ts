import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getAdminNotificationCounts } from "./admin-operations";

export type DashboardHeaderSummary = {
  walletBalance: string | null;
  notificationCount: number | null;
};

// Only request-local memoization: balances and permissions are never cached across users.
export const getDashboardHeaderSummary = cache(async (userId: string, isActiveAdmin: boolean): Promise<DashboardHeaderSummary> => {
  const [walletBalance, notificationCount] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } })
      .then(wallet => wallet?.balance.toFixed(2) ?? null)
      .catch(() => null),
    isActiveAdmin
      ? getAdminNotificationCounts()
          .then(counts => counts.pendingWarehouseRequestCount + counts.pendingAccessRequestCount + counts.pendingQcImeiRequestCount)
          .catch(() => null)
      : Promise.resolve(0),
  ]);
  return { walletBalance, notificationCount };
});
