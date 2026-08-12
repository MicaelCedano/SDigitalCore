import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getQcDashboardAction } from "@/modules/qc/actions/revision-batch";
import { QcDashboardView } from "@/modules/qc/components/QcDashboardView";

export const metadata: Metadata = {
  title: "Panel QC | Control de Calidad | SDigitalCore",
  description: "Lotes de revisión asignados y estadísticas del control de calidad",
};

export default async function QcPage() {
  await requirePermission("qc.read");
  const persisted = await getPersistedCurrentUser();

  // El administrador gestiona los lotes desde la lista completa
  if (persisted?.roleCode === "ADMIN") {
    redirect("/qc/lotes");
  }

  const res = await getQcDashboardAction();
  return <QcDashboardView data={res.data} />;
}
