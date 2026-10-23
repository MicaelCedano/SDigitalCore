import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getDashboardHeaderSummary } from "@/lib/dashboard/header-summary";

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
  // Stream optional header indicators; module content only waits for authentication.
  const userId = persistedUser?.id ?? user.id;
  const headerSummary = userId
    ? getDashboardHeaderSummary(userId, persistedUser?.roleCode === "ADMIN" && persistedUser.status === "ACTIVE")
    : Promise.resolve({ walletBalance: null, notificationCount: null });

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
      headerSummary={headerSummary}
    >
      {children}
    </DashboardLayoutClient>
  );
}

