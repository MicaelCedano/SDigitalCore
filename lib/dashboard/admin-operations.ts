import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

export const getAdminOperationsOverview = cache(async (userId: string) => {
  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleCode: true, status: true },
  });

  if (admin?.roleCode !== "ADMIN" || admin.status !== "ACTIVE") return null;

  const [
    pendingWarehouseRequestCount,
    pendingWarehouseRequests,
    pendingAccessRequestCount,
    latestAccessRequest,
    latestReceipt,
    recentWarrantyCases,
    recentWarrantyEvents,
    warrantyGroupStats,
  ] = await Promise.all([
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
    prisma.warrantyCase.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        caseCode: true,
        imei: true,
        model: true,
        clientName: true,
        problem: true,
        status: true,
        entryDate: true,
        createdAt: true,
        assignedTechnicianName: true,
        currentSupplierName: true,
      },
    }),
    prisma.warrantyEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        actorNameSnapshot: true,
        counterpartyName: true,
        reason: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            caseCode: true,
            model: true,
            imei: true,
            clientName: true,
          },
        },
      },
    }),
    prisma.warrantyCase.groupBy({
      by: ["status"],
      where: { archivedAt: null },
      _count: { _all: true },
    }),
  ]);

  const warrantyCounts = warrantyGroupStats.reduce<Record<string, number>>(
    (acc, curr) => {
      acc[curr.status] = curr._count._all;
      acc.totalActive = (acc.totalActive || 0) + curr._count._all;
      return acc;
    },
    { totalActive: 0 },
  );

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
    recentWarrantyCases,
    recentWarrantyEvents,
    warrantyCounts,
  };
});

export const getAdminNotificationCounts = cache(async () => {
  const [pendingWarehouseRequestCount, pendingAccessRequestCount] = await Promise.all([
    prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
  ]);

  return { pendingWarehouseRequestCount, pendingAccessRequestCount };
});
