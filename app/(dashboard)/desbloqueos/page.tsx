import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getUnlockDashboardAction } from "@/modules/desbloqueos/actions/unlocks";
import { UnlockDashboard } from "@/modules/desbloqueos/components/UnlockDashboard";

export const metadata: Metadata = {
  title: "Desbloqueos | SDigitalCore",
  description: "Solicitudes de desbloqueo y pago a técnicos",
};

export default async function DesbloqueosPage() {
  await requirePermission("desbloqueos.read");
  const persisted = await getPersistedCurrentUser();

  // El administrador gestiona desde la lista completa
  if (persisted?.roleCode === "ADMIN") {
    redirect("/desbloqueos/pagos");
  }

  const res = await getUnlockDashboardAction();
  if (!res.success) {
    throw new Error(res.error);
  }
  return <UnlockDashboard initialData={res.data} />;
}
