import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPersistedCurrentUser, requirePermission } from "@/lib/auth/helpers";
import { ActiveQcAssignmentsView } from "@/modules/qc/components/ActiveQcAssignmentsView";

export const metadata: Metadata = {
  title: "Asignaciones QC | Control de Calidad | SDigitalCore",
  description: "Progreso de las asignaciones activas de control de calidad por lote y revisor.",
};

export default async function ActiveQcAssignmentsPage() {
  await requirePermission("qc.read");
  const persisted = await getPersistedCurrentUser();
  if (persisted?.roleCode !== "ADMIN") redirect("/qc");
  return <ActiveQcAssignmentsView />;
}
