import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getAdminNotificationCounts } from "@/lib/dashboard/admin-operations";

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

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
      notificationCount={(notificationCounts?.pendingWarehouseRequestCount ?? 0) + (notificationCounts?.pendingAccessRequestCount ?? 0)}
    >
      {children}
    </DashboardLayoutClient>
  );
}
