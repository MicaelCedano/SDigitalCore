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
    pendingAccessRequests,
    latestReceipt,
    recentWarrantyCases,
    recentWarrantyEvents,
    warrantyGroupStats,
    repairJobsPending,
    unlockRequestsPending,
    qcBatchesPending,
    walletRedemptionsPending,
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
    // Reparaciones: trabajos pendientes de pago (admin aprueba en /reparaciones/pagos)
    prisma.repairJob.findMany({
      where: { status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        jobCode: true,
        totalEquipos: true,
        montoTotal: true,
        montoPorEquipo: true,
        createdAt: true,
        technician: { select: { name: true, username: true } },
      },
    }),
    // Desbloqueos: solicitudes pendientes de aprobar/pagar
    prisma.unlockRequest.findMany({
      where: { status: "PENDING_ADMIN" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestCode: true,
        model: true,
        totalEquipos: true,
        montoTotalPagado: true,
        createdAt: true,
        technician: { select: { name: true, username: true } },
      },
    }),
    // QC: lotes de revisión pendientes, en revisión o enviados a aprobación
    prisma.qcRevisionBatch.findMany({
      where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW", "SUBMITTED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        batchNumber: true,
        supplierName: true,
        status: true,
        totalDevices: true,
        reviewedDevices: true,
        createdAt: true,
      },
    }),
    // Wallet: retiros pendientes de canje (bauchers generados sin redimir)
    prisma.walletLedgerEntry.findMany({
      where: { secureToken: { not: null }, redeemedAt: null, status: "POSTED", reversalOfId: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        description: true,
        createdAt: true,
        wallet: {
          select: { user: { select: { name: true, username: true } } },
        },
      },
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

  const repairPendingTotal = repairJobsPending.reduce((sum, job) => sum + Number(job.montoTotal), 0);
  const unlockPendingTotal = unlockRequestsPending.reduce((sum, req) => sum + Number(req.montoTotalPagado), 0);
  const qcPendingTotalDevices = qcBatchesPending.reduce((sum, batch) => sum + batch.totalDevices, 0);
  const redemptionsPendingTotal = walletRedemptionsPending.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    pendingWarehouseRequestCount,
    pendingWarehouseRequests,
    pendingAccessRequestCount,
    pendingAccessRequests,
    latestAccessRequestAt: pendingAccessRequests[0]?.createdAt ?? null,
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
    // Módulos activos: reparaciones, desbloqueos, QC, wallet
    repairJobsPending,
    repairPendingCount: repairJobsPending.length,
    repairPendingTotal,
    unlockRequestsPending,
    unlockPendingCount: unlockRequestsPending.length,
    unlockPendingTotal,
    qcBatchesPending,
    qcPendingCount: qcBatchesPending.length,
    qcPendingTotalDevices,
    walletRedemptionsPending,
    redemptionsPendingCount: walletRedemptionsPending.length,
    redemptionsPendingTotal,
  };
});

export const getAdminNotificationCounts = cache(async () => {
  const [pendingWarehouseRequestCount, pendingAccessRequestCount] = await Promise.all([
    prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
  ]);

  return { pendingWarehouseRequestCount, pendingAccessRequestCount };
});
