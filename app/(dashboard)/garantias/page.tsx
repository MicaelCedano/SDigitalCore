import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { getWarrantyDashboardStats, listWarrantyCases } from "@/modules/garantias/actions/warranty";
import { WarrantyDashboard } from "@/modules/garantias/components/WarrantyDashboard";
import { can } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import type { WarrantyStatus } from "@prisma/client";
import type { WarrantyFlowCase } from "@/modules/garantias/components/WarrantyFlow";

export const metadata: Metadata = { title: "Gestión de Garantías" };

export default async function GarantiasPage() {
  await requirePermission("warranties.read");
  const [cases, stats, canTransition, canCreate] = await Promise.all([listWarrantyCases({ pageSize: 25 }), getWarrantyDashboardStats(), can("warranties.transition"), can("warranties.create")]);
  if (!cases.success) throw new Error(cases.error);
  if (!stats.success) throw new Error(stats.error);

  const eligible: Record<string, WarrantyStatus[]> = { assign: ["RECEIVED", "RECEIVED_FROM_SUPPLIER"], receiveTech: ["TECHNICIAN_REPORTED_REPAIRED", "TECHNICIAN_REPORTED_UNREPAIRED", "IN_REPAIR"], sendSupplier: ["RECEIVED", "RECEIVED_FROM_TECHNICIAN"], receiveSupplier: ["SENT_TO_SUPPLIER"], markReady: ["RECEIVED_FROM_TECHNICIAN", "RECEIVED_FROM_SUPPLIER"], deliver: ["READY_FOR_CUSTOMER"], credit: ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN", "SENT_TO_SUPPLIER", "RECEIVED_FROM_SUPPLIER", "READY_FOR_CUSTOMER"] };
  const quickCases: Record<string, WarrantyFlowCase[]> = canTransition
    ? Object.fromEntries(Object.keys(eligible).map((operation) => [operation, []]))
    : {};
  if (canTransition) {
    const eligibleStatuses = [...new Set(Object.values(eligible).flat())];
    const quickRows = await prisma.warrantyCase.findMany({
      where: { archivedAt: null, status: { in: eligibleStatuses } },
      orderBy: { entryDate: "asc" },
      take: 500,
      select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true, assignedTechnicianName: true, currentSupplierName: true },
    });
    for (const [operation, statuses] of Object.entries(eligible)) {
      quickCases[operation] = quickRows.filter((row) => statuses.includes(row.status));
    }
  }

  return (
    <WarrantyDashboard
      initialCases={cases.data.cases as never[]}
      total={cases.data.total}
      page={cases.data.page}
      pageSize={cases.data.pageSize}
      stats={stats.data}
      quickCases={quickCases}
      canCreate={canCreate}
      canTransition={canTransition}
    />
  );
}
