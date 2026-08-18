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
    pendingQcImeiRequests,
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
    prisma.qcImeiRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        imeis: true,
        requester: { select: { name: true, username: true, email: true } },
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
        secureToken: true,
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
      if (curr.status !== "DELIVERED" && curr.status !== "CREDIT_NOTE") {
        acc.totalActive = (acc.totalActive || 0) + curr._count._all;
      }
      return acc;
    },
    { totalActive: 0 },
  );

  const repairPendingTotal = repairJobsPending.reduce((sum, job) => sum + Number(job.montoTotal), 0);
  const unlockPendingTotal = unlockRequestsPending.reduce((sum, req) => sum + Number(req.montoTotalPagado), 0);

  // Las porciones QC se envían y se pagan por revisor. Se proyectan desde la
  // auditoría para no bloquear el dashboard hasta que termine el lote global.
  const assignmentAudits = await prisma.auditLog.findMany({
    where: { action: { in: ["qc_batch.assignment_submit", "qc_batch.assignment_reject", "qc_batch.assignment_approve"] } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { entityId: true, action: true, createdAt: true, afterData: true },
  });
  const latestAssignments = new Map<string, { batchId: string; reviewerId: string; reviewerName: string; totalDevices: number; reviewedDevices: number; submittedAt: Date }>();
  const seenAssignments = new Set<string>();
  for (const audit of assignmentAudits) {
    const data = audit.afterData && typeof audit.afterData === "object" ? audit.afterData as Record<string, unknown> : {};
    const reviewerId = typeof data.reviewerId === "string" ? data.reviewerId : null;
    if (!audit.entityId || !reviewerId) continue;
    const key = `${audit.entityId}:${reviewerId}`;
    if (seenAssignments.has(key)) continue;
    seenAssignments.add(key);
    if (audit.action !== "qc_batch.assignment_submit") continue;
    latestAssignments.set(key, {
      batchId: audit.entityId,
      reviewerId,
      reviewerName: typeof data.reviewerName === "string" ? data.reviewerName : "QC",
      totalDevices: Number(data.assignedDevices) || 0,
      reviewedDevices: Number(data.reviewedDevices) || 0,
      submittedAt: audit.createdAt,
    });
  }
  const assignmentBatchIds = [...new Set([...latestAssignments.values()].map((item) => item.batchId))];
  const assignmentBatches = await prisma.qcRevisionBatch.findMany({
    where: { id: { in: assignmentBatchIds } },
    select: { id: true, batchNumber: true, supplierName: true },
  });
  const assignmentBatchById = new Map(assignmentBatches.map((batch) => [batch.id, batch]));
  const assignmentPaymentKeys = [...latestAssignments.values()].map((item) => `qc-payment:${item.batchId}:${item.reviewerId}`);
  const paidAssignments = await prisma.walletLedgerEntry.findMany({
    where: { externalKey: { in: assignmentPaymentKeys }, type: "CREDIT", status: "POSTED" },
    select: { externalKey: true },
  });
  const paidAssignmentKeys = new Set(paidAssignments.map((entry) => entry.externalKey));
  const partialQcBatches: any[] = [];
  for (const assignment of latestAssignments.values()) {
    const batch = assignmentBatchById.get(assignment.batchId);
    if (!batch || paidAssignmentKeys.has(`qc-payment:${assignment.batchId}:${assignment.reviewerId}`)) continue;
    partialQcBatches.push({
      id: assignment.batchId,
      assignmentKey: `qc-payment:${assignment.batchId}:${assignment.reviewerId}`,
      reviewerId: assignment.reviewerId,
      reviewerName: assignment.reviewerName,
      batchNumber: batch.batchNumber,
      supplierName: batch.supplierName,
      status: "SUBMITTED",
      totalDevices: assignment.totalDevices,
      reviewedDevices: assignment.reviewedDevices,
      createdAt: assignment.submittedAt,
    });
  }
  const qcBatchesForDashboard: any[] = [...qcBatchesPending, ...partialQcBatches];
  const qcPendingTotalDevices = qcBatchesForDashboard.reduce((sum, batch) => sum + batch.totalDevices, 0);
  const qcSubmittedBatches = qcBatchesForDashboard.filter((b) => b.status === "SUBMITTED");
  const qcSubmittedPendingTotal = qcSubmittedBatches.reduce((sum, b) => sum + b.reviewedDevices * 50, 0);
  const redemptionsPendingTotal = walletRedemptionsPending.reduce((sum, e) => sum + Number(e.amount), 0);

  // Consulta de Centro de Trabajo
  const weekStart = startOfCurrentWeekInSantoDomingo();
  const now = new Date();

  let workCenter = {
    totalActive: 0,
    inProgressCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    urgentCount: 0,
    completedWeekCount: 0,
    inProgressTasks: [] as Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      sourceModule: string;
      sourceCode: string | null;
      sourceUrl: string | null;
      dueAt: Date | null;
      createdAt: Date;
      progressDone: number;
      progressTotal: number | null;
      assignees: {
        user: { id: string; name: string | null; email: string; image: string | null };
      }[];
      assignee: { id: string; name: string | null; email: string; image: string | null } | null;
    }>,
    pendingTasks: [] as Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      sourceModule: string;
      sourceCode: string | null;
      sourceUrl: string | null;
      dueAt: Date | null;
      createdAt: Date;
      progressDone: number;
      progressTotal: number | null;
      assignees: {
        user: { id: string; name: string | null; email: string; image: string | null };
      }[];
      assignee: { id: string; name: string | null; email: string; image: string | null } | null;
    }>,
    teamMembers: [] as Array<{
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      currentTaskTitle: string | null;
      currentTaskModule: string | null;
      currentTaskCode: string | null;
      activeCount: number;
    }>,
  };

  try {
    const [activeTasks, completedWeekCount, activeUsers] = await Promise.all([
      prisma.workTask.findMany({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS", "IN_REVIEW"] },
        },
        include: {
          assignee: { select: { id: true, name: true, email: true, image: true } },
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
            orderBy: { assignedAt: "asc" },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        take: 40,
      }),
      prisma.workTask.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: weekStart },
        },
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE", allowedModules: { has: "centro-trabajo" } },
        select: { id: true, name: true, email: true, image: true },
        orderBy: { name: "asc" },
        take: 30,
      }),
    ]);

    const inProgressTasks = activeTasks.filter((t) => t.status === "IN_PROGRESS");
    const pendingTasks = activeTasks.filter((t) => t.status === "PENDING" || t.status === "IN_REVIEW");
    const overdueCount = activeTasks.filter((t) => t.dueAt && t.dueAt < now).length;
    const urgentCount = activeTasks.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;

    const teamMembers = activeUsers.map((user) => {
      const userInProgressTask = inProgressTasks.find(
        (t) =>
          t.assignees.some((a) => a.user.id === user.id) ||
          t.assignee?.id === user.id,
      );
      const userActiveTasks = activeTasks.filter(
        (t) =>
          t.assignees.some((a) => a.user.id === user.id) ||
          t.assignee?.id === user.id,
      );
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        currentTaskTitle: userInProgressTask ? userInProgressTask.title : null,
        currentTaskModule: userInProgressTask ? userInProgressTask.sourceModule : null,
        currentTaskCode: userInProgressTask ? userInProgressTask.sourceCode : null,
        activeCount: userActiveTasks.length,
      };
    });

    workCenter = {
      totalActive: activeTasks.length,
      inProgressCount: inProgressTasks.length,
      pendingCount: pendingTasks.length,
      overdueCount,
      urgentCount,
      completedWeekCount,
      inProgressTasks: inProgressTasks.slice(0, 6),
      pendingTasks: pendingTasks.slice(0, 6),
      teamMembers,
    };
  } catch (error) {
    console.error("[dashboard] Error loading workCenter data in overview:", error);
  }

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
    // Centro de Trabajo
    workCenter,
    // Módulos activos: reparaciones, desbloqueos, QC, wallet
    repairJobsPending: repairJobsPending.map((job) => ({
      ...job,
      montoTotal: Number(job.montoTotal),
      montoPorEquipo: Number(job.montoPorEquipo),
    })),
    repairPendingCount: repairJobsPending.length,
    repairPendingTotal,
    unlockRequestsPending: unlockRequestsPending.map((req) => ({
      ...req,
      montoTotalPagado: Number(req.montoTotalPagado),
    })),
    unlockPendingCount: unlockRequestsPending.length,
    unlockPendingTotal,
    qcBatchesPending: qcBatchesForDashboard,
    qcPendingCount: qcBatchesForDashboard.length,
    qcPendingTotalDevices,
    qcSubmittedCount: qcSubmittedBatches.length,
    qcSubmittedPendingTotal,
    pendingQcImeiRequests,
    walletRedemptionsPending: walletRedemptionsPending.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
    })),
    redemptionsPendingCount: walletRedemptionsPending.length,
    redemptionsPendingTotal,
  };
});

function startOfCurrentWeekInSantoDomingo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const localDateAsUtc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDateAsUtc.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(Date.UTC(year, month - 1, day - daysSinceMonday, 4));
}

export const getAdminNotificationCounts = cache(async () => {
  const [pendingWarehouseRequestCount, pendingAccessRequestCount, pendingQcImeiRequestCount] = await Promise.all([
    prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
    prisma.qcImeiRequest.count({ where: { status: "PENDING" } }),
  ]);

  return { pendingWarehouseRequestCount, pendingAccessRequestCount, pendingQcImeiRequestCount };
});
