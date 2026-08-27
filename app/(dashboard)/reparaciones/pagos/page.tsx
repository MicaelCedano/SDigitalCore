import type { Metadata } from "next";
import { getPersistedCurrentUser, requirePermission } from "@/lib/auth/helpers";
import { getPendingRepairJobsAction, getTechnicianRepairRatesAction } from "@/modules/reparaciones/actions/repairs";
import { PendingRepairApproval } from "@/modules/reparaciones/components/PendingRepairApproval";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Aprobar Pagos | Reparaciones | SDigitalCore",
  description: "Trabajos de reparación pendientes de aprobación y pago",
};

export default async function ReparacionesPagosPage() {
  await requirePermission("reparaciones.write");
  const user = await getPersistedCurrentUser();
  if (user?.roleCode !== "ADMIN") redirect("/reparaciones");
  const [jobsRes, ratesRes] = await Promise.all([getPendingRepairJobsAction(), getTechnicianRepairRatesAction()]);
  if (!jobsRes.success) throw new Error(jobsRes.error);
  if (!ratesRes.success) throw new Error(ratesRes.error);

  return <PendingRepairApproval initialJobs={jobsRes.data} initialRates={ratesRes.data} />;
}
