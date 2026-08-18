import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getAdminNotificationCounts } from "@/lib/dashboard/admin-operations";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, persistedUser] = await Promise.all([
    requireUser(),
    getPersistedCurrentUser(),
  ]);
  const allowedModules = persistedUser?.roleCode === "ADMIN" ? undefined : persistedUser?.allowedModules ?? [];
  const [notificationCounts, walletBalance] = await Promise.all([
    persistedUser?.roleCode === "ADMIN" && persistedUser.status === "ACTIVE"
      ? getAdminNotificationCounts()
      : Promise.resolve(null),
    (async () => {
      try {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: user.id },
          select: { balance: true },
        });
        return wallet ? wallet.balance.toFixed(2) : null;
      } catch {
        return null;
      }
    })(),
  ]);

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
      walletBalance={walletBalance}
      notificationCount={(notificationCounts?.pendingWarehouseRequestCount ?? 0) + (notificationCounts?.pendingAccessRequestCount ?? 0) + (notificationCounts?.pendingQcImeiRequestCount ?? 0)}
    >
      {children}
    </DashboardLayoutClient>
  );
}

