import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { WarrantyFlow } from "@/modules/garantias/components/WarrantyFlow";
import type { WarrantyStatus } from "@prisma/client";
const eligible: Record<string, WarrantyStatus[]> = { assign: ["RECEIVED", "RECEIVED_FROM_SUPPLIER"], receiveTech: ["TECHNICIAN_REPORTED_REPAIRED", "TECHNICIAN_REPORTED_UNREPAIRED", "IN_REPAIR"], sendSupplier: ["RECEIVED","RECEIVED_FROM_TECHNICIAN"], receiveSupplier: ["SENT_TO_SUPPLIER"], markReady: ["RECEIVED_FROM_TECHNICIAN", "RECEIVED_FROM_SUPPLIER"], deliver: ["READY_FOR_CUSTOMER"], credit: ["RECEIVED","IN_REPAIR","RECEIVED_FROM_TECHNICIAN","SENT_TO_SUPPLIER","RECEIVED_FROM_SUPPLIER","READY_FOR_CUSTOMER"] };
type Operation = "assign" | "receiveTech" | "sendSupplier" | "receiveSupplier" | "markReady" | "deliver" | "credit";
export async function renderWarrantyFlow(operation: Operation) {
  await requirePermission("warranties.transition");

  const cases = await prisma.warrantyCase.findMany({
    where: { archivedAt: null, status: { in: eligible[operation] } },
    orderBy: { entryDate: "asc" },
    select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true, assignedTechnicianName: true, currentSupplierName: true },
  });
  const sandy = operation === "assign" || operation === "receiveTech"
    ? await prisma.user.findFirst({
        where: {
          status: "ACTIVE",
          OR: [
            { username: { equals: "sandy", mode: "insensitive" } },
            { name: { contains: "sandy", mode: "insensitive" } },
          ],
        },
        select: { name: true, username: true },
      })
    : null;
  const defaultCounterparty = sandy?.name || sandy?.username || undefined;

  return <div className="mx-auto max-w-[1000px]"><WarrantyFlow operation={operation} cases={cases} defaultCounterparty={defaultCounterparty} /></div>;
}
