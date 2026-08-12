import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getAdminNotificationCounts } from "@/lib/dashboard/admin-operations";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const persistedUser = await getPersistedCurrentUser();
  const allowedModules = persistedUser?.roleCode === "ADMIN" ? undefined : persistedUser?.allowedModules ?? [];
  const notificationCounts = persistedUser?.roleCode === "ADMIN" && persistedUser.status === "ACTIVE"
    ? await getAdminNotificationCounts()
    : null;

  // Balance de wallet para mostrarlo en el perfil (solo si el usuario tiene wallet)
  let walletBalance: string | null = null;
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
      select: { balance: true },
    });
    if (wallet) walletBalance = wallet.balance.toFixed(2);
  } catch {
    walletBalance = null;
  }

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
      walletBalance={walletBalance}
      notificationCount={(notificationCounts?.pendingWarehouseRequestCount ?? 0) + (notificationCounts?.pendingAccessRequestCount ?? 0)}
    >
      {children}
    </DashboardLayoutClient>
  );
}
