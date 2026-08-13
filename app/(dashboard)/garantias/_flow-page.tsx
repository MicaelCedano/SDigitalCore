import { getPersistedCurrentUser, requirePermission, requireUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { WarrantyFlow } from "@/modules/garantias/components/WarrantyFlow";
import type { WarrantyStatus } from "@prisma/client";
const eligible: Record<string, WarrantyStatus[]> = { assign: ["RECEIVED", "RECEIVED_FROM_SUPPLIER"], receiveTech: ["IN_REPAIR"], sendSupplier: ["RECEIVED","IN_REPAIR","RECEIVED_FROM_TECHNICIAN"], receiveSupplier: ["SENT_TO_SUPPLIER"], deliver: ["RECEIVED","RECEIVED_FROM_TECHNICIAN","RECEIVED_FROM_SUPPLIER"], credit: ["RECEIVED","IN_REPAIR","RECEIVED_FROM_TECHNICIAN","SENT_TO_SUPPLIER","RECEIVED_FROM_SUPPLIER"] };
type Operation = "assign" | "receiveTech" | "sendSupplier" | "receiveSupplier" | "deliver" | "credit";
export async function renderWarrantyFlow(operation: Operation) {
  const user = await requireUser();
  const persistedUser = await getPersistedCurrentUser();
  const technicianReceiving = operation === "receiveTech" && persistedUser?.status === "ACTIVE" && persistedUser.roleCode === "TECNICO";

  if (!technicianReceiving) await requirePermission("warranties.transition");

  const cases = await prisma.warrantyCase.findMany({
    where: { archivedAt: null, status: { in: eligible[operation] } },
    orderBy: { entryDate: "asc" },
    select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true, assignedTechnicianName: true, currentSupplierName: true },
  });
  const receiverName = technicianReceiving ? user.name || user.email || "Técnico" : undefined;

  return <div className="mx-auto max-w-[1000px]"><WarrantyFlow operation={operation} cases={cases} defaultCounterparty={receiverName} /></div>;
}
