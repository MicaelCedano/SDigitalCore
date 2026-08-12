import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getRepairDashboardAction } from "@/modules/reparaciones/actions/repairs";
import { RepairDashboard } from "@/modules/reparaciones/components/RepairDashboard";

export const metadata: Metadata = {
  title: "Reparaciones | SDigitalCore",
  description: "Cola de reparaciones asignadas y trabajos reportados",
};

export default async function ReparacionesPage() {
  await requirePermission("reparaciones.read");
  const persisted = await getPersistedCurrentUser();

  // El administrador gestiona los pagos desde la lista completa
  if (persisted?.roleCode === "ADMIN") {
    redirect("/reparaciones/pagos");
  }

  const res = await getRepairDashboardAction();
  if (!res.success) {
    throw new Error(res.error);
  }
  const data = res.data.data;
  return <RepairDashboard initialData={data} />;
}
