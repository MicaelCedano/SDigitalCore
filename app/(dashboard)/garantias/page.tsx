import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { getWarrantyDashboardStats, listWarrantyCases } from "@/modules/garantias/actions/warranty";
import { WarrantyDashboard } from "@/modules/garantias/components/WarrantyDashboard";
import { can } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import type { WarrantyStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Gestión de Garantías" };

export default async function GarantiasPage() {
  await requirePermission("warranties.read");
  const [cases, stats, canTransition, canCreate] = await Promise.all([listWarrantyCases({ pageSize: 25 }), getWarrantyDashboardStats(), can("warranties.transition"), can("warranties.create")]);
  if (!cases.success) throw new Error(cases.error);
  if (!stats.success) throw new Error(stats.error);

  const eligible: Record<string, WarrantyStatus[]> = { assign: ["RECEIVED"], receiveTech: ["IN_REPAIR"], sendSupplier: ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN"], receiveSupplier: ["SENT_TO_SUPPLIER"], deliver: ["RECEIVED", "RECEIVED_FROM_TECHNICIAN", "RECEIVED_FROM_SUPPLIER"], credit: ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN", "SENT_TO_SUPPLIER", "RECEIVED_FROM_SUPPLIER"] };
  const quickCases = canTransition ? Object.fromEntries(await Promise.all(Object.entries(eligible).map(async ([operation, statuses]) => [operation, await prisma.warrantyCase.findMany({ where: { archivedAt: null, status: { in: statuses } }, orderBy: { entryDate: "asc" }, take: 200, select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true } })]))) : {};

  return (
    <WarrantyDashboard
      initialCases={cases.data.cases as never[]}
      total={cases.data.total}
      page={cases.data.page}
      pageSize={cases.data.pageSize}
      stats={stats.data}
      quickCases={quickCases}
      canCreate={canCreate}
    />
  );
}
