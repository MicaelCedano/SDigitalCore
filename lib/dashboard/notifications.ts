import type { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { WARRANTY_EVENT_LABELS } from "@/modules/garantias/lib/status-machine";

type AdminOverview = NonNullable<Awaited<ReturnType<typeof getAdminOperationsOverview>>>;

export function toAdminNotifications(overview: AdminOverview) {
  return [
    ...overview.pendingWarehouseRequests.map((request) => ({
      id: `warehouse-${request.id}`,
      title: `Solicitud ${request.requestCode} pendiente`,
      description: `${request.requestedBy} solicita una ${request.type === "ENTRY" ? "entrada" : "salida"} para ${request.branch}.`,
      href: "/almacen/transferencias",
      createdAt: request.createdAt.toISOString(),
      kind: "action" as const,
    })),
    ...(overview.pendingAccessRequests ?? []).map((req) => ({
      id: `access-req-${req.id}`,
      title: `Solicitud de acceso: ${req.name}`,
      description: `${req.username} (${req.email}) solicita aprobación y asignación de permisos.`,
      href: "/configuracion",
      createdAt: req.createdAt.toISOString(),
      kind: "action" as const,
    })),
    ...(overview.latestReceipt
      ? [{
          id: `receipt-${overview.latestReceipt.id}`,
          title: `Último recibo: ${overview.latestReceipt.receiptNumber}`,
          description: `${overview.latestReceipt.supplierName} · ${overview.latestReceipt.unitCount} unidades recibidas.`,
          href: "/almacen/recibos",
          createdAt: overview.latestReceipt.receivedAt.toISOString(),
          kind: "activity" as const,
        }]
      : []),
    ...(overview.recentWarrantyEvents ?? []).slice(0, 3).map((evt) => ({
      id: `warranty-evt-${evt.id}`,
      title: `Garantía ${evt.case.caseCode}: ${WARRANTY_EVENT_LABELS[evt.type] ?? evt.type}`,
      description: `${evt.case.model}${evt.actorNameSnapshot ? ` · por ${evt.actorNameSnapshot}` : ""}`,
      href: `/garantias/${evt.case.caseCode}`,
      createdAt: evt.createdAt.toISOString(),
      kind: "activity" as const,
    })),
  ];
}
