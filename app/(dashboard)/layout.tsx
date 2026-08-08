import { requireUser } from "@/lib/auth/helpers";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <DashboardLayoutClient userName={user.name} userEmail={user.email}>
      {children}
    </DashboardLayoutClient>
  );
}
