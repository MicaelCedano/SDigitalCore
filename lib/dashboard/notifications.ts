import type { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";

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
    ...(overview.pendingAccessRequestCount > 0
      ? [{
          id: "pending-access-requests",
          title: `${overview.pendingAccessRequestCount} solicitud${overview.pendingAccessRequestCount === 1 ? "" : "es"} de acceso`,
          description: "Hay usuarios esperando aprobación y asignación de permisos.",
          href: "/configuracion",
          createdAt: overview.latestAccessRequestAt?.toISOString() ?? new Date().toISOString(),
          kind: "action" as const,
        }]
      : []),
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
  ];
}
