import type { Metadata } from "next";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getQcDashboardAction } from "@/modules/qc/actions/revision-batch";
import { QcDashboardView } from "@/modules/qc/components/QcDashboardView";
import { AdminQcOverview } from "@/modules/qc/components/AdminQcOverview";

export const metadata: Metadata = {
  title: "Panel QC | Control de Calidad | SDigitalCore",
  description: "Lotes de revisión asignados y estadísticas del control de calidad",
};

export default async function QcPage() {
  await requirePermission("qc.read");
  const persisted = await getPersistedCurrentUser();

  if (persisted?.roleCode === "ADMIN") {
    return <AdminQcOverview />;
  }

  const res = await getQcDashboardAction();
  return <QcDashboardView initialData={res.data} />;
}
