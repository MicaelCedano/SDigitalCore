import { requireUser } from "@/lib/auth/helpers";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { prisma } from "@/lib/db/prisma";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const persistedUser = await prisma.user.findFirst({
    where: user.id ? { id: user.id } : { email: user.email ?? "" },
    select: { id: true, roleCode: true, allowedModules: true, image: true },
  });
  const allowedModules = persistedUser?.roleCode === "ADMIN" ? undefined : persistedUser?.allowedModules ?? [];
  const overview = persistedUser?.roleCode === "ADMIN"
    ? await getAdminOperationsOverview(persistedUser.id)
    : null;
  const notifications = [
    ...(overview?.pendingWarehouseRequests.map((request) => ({
      id: `warehouse-${request.id}`,
      title: `Solicitud ${request.requestCode} pendiente`,
      description: `${request.requestedBy} solicita una ${request.type === "ENTRY" ? "entrada" : "salida"} para ${request.branch}.`,
      href: "/almacen/transferencias",
      createdAt: request.createdAt.toISOString(),
      kind: "action" as const,
    })) ?? []),
    ...(overview && overview.pendingAccessRequestCount > 0
      ? [{
          id: "pending-access-requests",
          title: `${overview.pendingAccessRequestCount} solicitud${overview.pendingAccessRequestCount === 1 ? "" : "es"} de acceso`,
          description: "Hay usuarios esperando aprobación y asignación de permisos.",
          href: "/configuracion",
          createdAt: overview.latestAccessRequestAt?.toISOString() ?? new Date().toISOString(),
          kind: "action" as const,
        }]
      : []),
    ...(overview?.latestReceipt
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

  return (
    <DashboardLayoutClient
      userName={user.name}
      userEmail={user.email}
      userRole={persistedUser?.roleCode}
      userAvatarUrl={persistedUser?.image}
      allowedModules={allowedModules}
      notifications={notifications}
      notificationCount={(overview?.pendingWarehouseRequestCount ?? 0) + (overview?.pendingAccessRequestCount ?? 0)}
    >
      {children}
    </DashboardLayoutClient>
  );
}
