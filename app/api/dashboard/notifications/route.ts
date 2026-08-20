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

  const [
    pendingWarehouseRequests,
    pendingAccessRequests,
    latestReceipt,
    recentWarrantyEvents,
    pendingQcImeiRequests,
    warehouseCount,
    accessCount,
    qcCount,
  ] = await Promise.all([
    prisma.warehouseRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestCode: true,
        requestedBy: true,
        type: true,
        branch: true,
        createdAt: true,
      },
    }),
    prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.goodsReceipt.findFirst({
      where: { status: { not: "CANCELLED" } },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        receiptNumber: true,
        supplierName: true,
        receivedAt: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.warrantyEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        type: true,
        actorNameSnapshot: true,
        createdAt: true,
        case: { select: { caseCode: true, model: true } },
      },
    }),
    prisma.qcImeiRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        requester: { select: { name: true, username: true, email: true } },
        imeis: true,
      },
    }),
    prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
    prisma.qcImeiRequest.count({ where: { status: "PENDING" } }),
  ]);

  const overviewForNotifications = {
    pendingWarehouseRequests,
    pendingAccessRequests,
    latestReceipt: latestReceipt
      ? {
          ...latestReceipt,
          itemCount: latestReceipt.items.length,
          unitCount: latestReceipt.items.reduce((total, item) => total + item.quantity, 0),
        }
      : null,
    recentWarrantyEvents,
  };

  const notifications = [
    ...toAdminNotifications(overviewForNotifications as never),
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

  const notificationCount = warehouseCount + accessCount + qcCount;

  return NextResponse.json({ notifications, notificationCount });
}
