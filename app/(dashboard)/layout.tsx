import { requireUser } from "@/lib/auth/helpers";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const persistedUser = await prisma.user.findFirst({
    where: user.id ? { id: user.id } : { email: user.email ?? "" },
    select: { roleCode: true, allowedModules: true, image: true },
  });
  const allowedModules = persistedUser?.roleCode === "ADMIN" ? undefined : persistedUser?.allowedModules ?? [];

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
    >
      {children}
    </DashboardLayoutClient>
  );
}
