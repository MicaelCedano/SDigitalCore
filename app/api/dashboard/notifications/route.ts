import { NextResponse } from "next/server";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { toAdminNotifications } from "@/lib/dashboard/notifications";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  await requireUser();
  const user = await getPersistedCurrentUser();

  if (!user || user.status !== "ACTIVE" || user.roleCode !== "ADMIN") {
    return NextResponse.json({ notifications: [], notificationCount: 0 });
  }

  const [overview, pendingQcImeiRequests] = await Promise.all([
    getAdminOperationsOverview(user.id),
    prisma.qcImeiRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        requester: { select: { name: true, username: true, email: true } },
        imeis: true,
      },
    }),
  ]);
  const notifications = [
    ...(overview ? toAdminNotifications(overview) : []),
    ...pendingQcImeiRequests.map((request) => {
      const requester = request.requester.name || request.requester.username || request.requester.email;
      const imeiCount = Array.isArray(request.imeis) ? request.imeis.length : 0;
      return {
        id: `qc-imei-request-${request.id}`,
        title: "Solicitud QC pendiente",
        description: `${requester} solicita revisar ${imeiCount} IMEI${imeiCount === 1 ? "" : "s"}.`,
        href: "/qc/solicitudes",
        createdAt: request.createdAt.toISOString(),
        kind: "action" as const,
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const notificationCount = overview
    ? overview.pendingWarehouseRequestCount + overview.pendingAccessRequestCount + pendingQcImeiRequests.length
    : 0;

  return NextResponse.json({ notifications, notificationCount });
}
