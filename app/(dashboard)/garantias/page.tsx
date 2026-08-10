import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { getWarrantyDashboardStats, listWarrantyCases } from "@/modules/garantias/actions/warranty";
import { WarrantyDashboard } from "@/modules/garantias/components/WarrantyDashboard";

export const metadata: Metadata = { title: "Gestión de Garantías" };

export default async function GarantiasPage() {
  await requirePermission("warranties.read");
  const [cases, stats] = await Promise.all([listWarrantyCases({ pageSize: 25 }), getWarrantyDashboardStats()]);
  if (!cases.success) throw new Error(cases.error);
  if (!stats.success) throw new Error(stats.error);

  return (
    <WarrantyDashboard
      initialCases={cases.data.cases as never[]}
      total={cases.data.total}
      page={cases.data.page}
      pageSize={cases.data.pageSize}
      stats={stats.data}
    />
  );
}
