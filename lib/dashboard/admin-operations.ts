import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

export const getAdminOperationsOverview = cache(async (userId: string) => {
  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleCode: true, status: true },
  });

  if (admin?.roleCode !== "ADMIN" || admin.status !== "ACTIVE") return null;

  const [pendingWarehouseRequestCount, pendingWarehouseRequests, pendingAccessRequestCount, latestAccessRequest, latestReceipt] =
    await Promise.all([
      prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
      prisma.warehouseRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          requestCode: true,
          title: true,
          branch: true,
          requestedBy: true,
          type: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.accessRequest.count({ where: { status: "PENDING" } }),
      prisma.accessRequest.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.goodsReceipt.findFirst({
        where: { status: { not: "CANCELLED" } },
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          receiptNumber: true,
          supplierName: true,
          branch: true,
          receivedBy: true,
          status: true,
          receivedAt: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);

  return {
    pendingWarehouseRequestCount,
    pendingWarehouseRequests,
    pendingAccessRequestCount,
    latestAccessRequestAt: latestAccessRequest?.createdAt ?? null,
    latestReceipt: latestReceipt
      ? {
          ...latestReceipt,
          itemCount: latestReceipt.items.length,
          unitCount: latestReceipt.items.reduce((total, item) => total + item.quantity, 0),
        }
      : null,
  };
});
