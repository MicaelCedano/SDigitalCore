import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type { WarrantyStatus } from "@prisma/client";

export type UserOperationsOverview = {
  sales?: {
    recentInvoices: {
      id: string;
      invoiceNumber: string;
      clientName: string;
      branch: string;
      type: "FACTURA" | "CONDUCE";
      total: number;
      status: string;
      createdAt: Date;
    }[];
    invoicesCountToday: number;
    totalAmountToday: number;
    priceListTotalCount: number;
    priceListFeatured: {
      id: string;
      model: string;
      brand: string | null;
      capacity: string | null;
      wholesalePrice: number;
      retailPrice: number;
    }[];
  };
  workCenter?: {
    totalPending: number;
    inProgressCount: number;
    urgentCount: number;
    completedWeekCount: number;
    myTasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      sourceModule: string;
      dueAt: Date | null;
      createdAt: Date;
      progressDone: number;
      progressTotal: number | null;
    }[];
  };
  warranties?: {
    totalActive: number;
    inWorkshopCount: number;
    inSupplierCount: number;
    readyForDispatchCount: number;
    recentCases: {
      id: string;
      caseCode: string;
      imei: string;
      model: string;
      clientName: string;
      problem: string;
      status: WarrantyStatus;
      createdAt: Date;
    }[];
  };
  warehouse?: {
    pendingRequestsCount: number;
    myRequests: {
      id: string;
      requestCode: string;
      title: string;
      branch: string;
      type: "ENTRY" | "EXIT";
      status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
      createdAt: Date;
      itemCount: number;
    }[];
    latestReceipt: {
      id: string;
      receiptNumber: string;
      supplierName: string;
      branch: string;
      receivedBy: string;
      receivedAt: Date;
      unitCount: number;
      status: string;
    } | null;
    totalProductsCount: number;
  };
  qc?: {
    assignedPendingCount: number;
    inspectedTodayCount: number;
    assignedDevices: {
      id: string;
      imei: string | null;
      model: string;
      brand: string | null;
      status: string;
      createdAt: Date;
    }[];
    recentInspections: {
      id: string;
      deviceModel: string;
      imei: string | null;
      result: string | null;
      grade: string | null;
      batteryHealth: number | null;
      reviewedAt: Date | null;
    }[];
  };
  repairs?: {
    pendingApprovalCount: number;
    completedCount: number;
    totalPendingAmount: number;
    recentJobs: {
      id: string;
      jobCode: string;
      totalEquipos: number;
      montoTotal: number;
      status: string;
      createdAt: Date;
    }[];
  };
  unlocks?: {
    pendingCount: number;
    approvedCount: number;
    totalPendingAmount: number;
    recentRequests: {
      id: string;
      requestCode: string;
      model: string;
      totalEquipos: number;
      montoTotalPagado: number;
      status: string;
      createdAt: Date;
    }[];
  };
  wallet?: {
    balance: number;
    recentTransactions: {
      id: string;
      amount: number;
      description: string;
      type: string;
      createdAt: Date;
    }[];
  };
};

function startOfTodayInSantoDomingo(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day, 4));
}

function startOfWeekInSantoDomingo(): Date {
  const today = startOfTodayInSantoDomingo();
  const dayOfWeek = today.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(today.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

export const getUserOperationsOverview = cache(
  async (userId: string, allowedModules: string[], roleCode: string): Promise<UserOperationsOverview> => {
    const moduleSet = new Set(allowedModules);
    const todayStart = startOfTodayInSantoDomingo();
    const weekStart = startOfWeekInSantoDomingo();

    const overview: UserOperationsOverview = {};

    const fetchers: Promise<void>[] = [];

    // 1. VENTAS: Precios & Facturas
    if (moduleSet.has("facturas") || moduleSet.has("precios") || roleCode === "VENTAS") {
      fetchers.push(
        (async () => {
          try {
            const [recentInvoices, todayInvoices, priceListTotalCount, priceListFeatured] = await Promise.all([
              prisma.invoice.findMany({
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  invoiceNumber: true,
                  clientName: true,
                  branch: true,
                  type: true,
                  total: true,
                  status: true,
                  createdAt: true,
                },
              }),
              prisma.invoice.findMany({
                where: { createdAt: { gte: todayStart } },
                select: { total: true },
              }),
              prisma.priceListItem.count({
                where: { status: "ACTIVE" },
              }),
              prisma.priceListItem.findMany({
                where: { status: "ACTIVE" },
                orderBy: [{ updatedAt: "desc" }],
                take: 5,
                select: {
                  id: true,
                  model: true,
                  brand: true,
                  capacity: true,
                  wholesalePrice: true,
                  retailPrice: true,
                },
              }),
            ]);

            const invoicesCountToday = todayInvoices.length;
            const totalAmountToday = todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

            overview.sales = {
              recentInvoices,
              invoicesCountToday,
              totalAmountToday,
              priceListTotalCount,
              priceListFeatured,
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching sales data:", e);
          }
        })()
      );
    }

    // 2. CENTRO DE TRABAJO
    if (moduleSet.has("centro-trabajo")) {
      fetchers.push(
        (async () => {
          try {
            const taskScope = {
              OR: [
                { creatorId: userId },
                { assigneeId: userId },
                { assignees: { some: { userId } } },
                { sourceModule: { in: allowedModules } },
              ],
            };

            const [myTasks, urgentCount, completedWeekCount, totalPending] = await Promise.all([
              prisma.workTask.findMany({
                where: {
                  ...taskScope,
                  status: { notIn: ["COMPLETED", "CANCELLED"] },
                },
                orderBy: [
                  { priority: "desc" },
                  { dueAt: "asc" },
                  { createdAt: "desc" },
                ],
                take: 6,
                select: {
                  id: true,
                  title: true,
                  status: true,
                  priority: true,
                  sourceModule: true,
                  dueAt: true,
                  createdAt: true,
                  progressDone: true,
                  progressTotal: true,
                },
              }),
              prisma.workTask.count({
                where: {
                  ...taskScope,
                  status: { notIn: ["COMPLETED", "CANCELLED"] },
                  priority: { in: ["HIGH", "URGENT"] },
                },
              }),
              prisma.workTask.count({
                where: {
                  ...taskScope,
                  status: "COMPLETED",
                  completedAt: { gte: weekStart },
                },
              }),
              prisma.workTask.count({
                where: {
                  ...taskScope,
                  status: { notIn: ["COMPLETED", "CANCELLED"] },
                },
              }),
            ]);

            const inProgressCount = myTasks.filter((t) => t.status === "IN_PROGRESS").length;

            overview.workCenter = {
              totalPending,
              inProgressCount,
              urgentCount,
              completedWeekCount,
              myTasks,
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching work center data:", e);
          }
        })()
      );
    }

    // 3. GESTIÓN DE GARANTÍAS
    if (moduleSet.has("garantias")) {
      fetchers.push(
        (async () => {
          try {
            const [totalActive, inWorkshopCount, inSupplierCount, readyForDispatchCount, recentCases] = await Promise.all([
              prisma.warrantyCase.count({
                where: { archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] } },
              }),
              prisma.warrantyCase.count({
                where: { archivedAt: null, status: "IN_REPAIR" },
              }),
              prisma.warrantyCase.count({
                where: { archivedAt: null, status: "SENT_TO_SUPPLIER" },
              }),
              prisma.warrantyCase.count({
                where: { archivedAt: null, status: "RECEIVED_FROM_TECHNICIAN" },
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
                  createdAt: true,
                },
              }),
            ]);

            overview.warranties = {
              totalActive,
              inWorkshopCount,
              inSupplierCount,
              readyForDispatchCount,
              recentCases,
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching warranties data:", e);
          }
        })()
      );
    }

    // 4. ALMACÉN
    if (moduleSet.has("almacen") || roleCode === "ALMACEN") {
      fetchers.push(
        (async () => {
          try {
            const [pendingRequestsCount, myRequests, latestReceipt, totalProductsCount] = await Promise.all([
              prisma.warehouseRequest.count({
                where: { status: "PENDING" },
              }),
              prisma.warehouseRequest.findMany({
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  requestCode: true,
                  title: true,
                  branch: true,
                  type: true,
                  status: true,
                  createdAt: true,
                  _count: { select: { items: true } },
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
                  receivedAt: true,
                  status: true,
                  items: { select: { quantity: true } },
                },
              }),
              prisma.warehouseProduct.count({
                where: { status: "ACTIVE" },
              }),
            ]);

            overview.warehouse = {
              pendingRequestsCount,
              myRequests: myRequests.map((r) => ({
                id: r.id,
                requestCode: r.requestCode,
                title: r.title,
                branch: r.branch,
                type: r.type,
                status: r.status,
                createdAt: r.createdAt,
                itemCount: r._count.items,
              })),
              latestReceipt: latestReceipt
                ? {
                    id: latestReceipt.id,
                    receiptNumber: latestReceipt.receiptNumber,
                    supplierName: latestReceipt.supplierName,
                    branch: latestReceipt.branch,
                    receivedBy: latestReceipt.receivedBy,
                    receivedAt: latestReceipt.receivedAt,
                    status: latestReceipt.status,
                    unitCount: latestReceipt.items.reduce((sum, it) => sum + (it.quantity || 0), 0),
                  }
                : null,
              totalProductsCount,
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching warehouse data:", e);
          }
        })()
      );
    }

    // 5. CONTROL DE CALIDAD (QC)
    if (moduleSet.has("qc") || roleCode === "QC") {
      fetchers.push(
        (async () => {
          try {
            const [assignedPendingCount, inspectedTodayCount, assignedDevices, recentInspections] = await Promise.all([
              prisma.deviceUnit.count({
                where: {
                  assignedToId: userId,
                  status: "PENDING_QC",
                },
              }),
              prisma.qcInspection.count({
                where: {
                  reviewerId: userId,
                  reviewedAt: { gte: todayStart },
                },
              }),
              prisma.deviceUnit.findMany({
                where: {
                  OR: [
                    { assignedToId: userId, status: "PENDING_QC" },
                    { status: "PENDING_QC" },
                  ],
                },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  imei: true,
                  model: true,
                  brand: true,
                  status: true,
                  createdAt: true,
                },
              }),
              prisma.qcInspection.findMany({
                where: { reviewerId: userId },
                orderBy: { reviewedAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  result: true,
                  grade: true,
                  batteryHealth: true,
                  reviewedAt: true,
                  device: {
                    select: {
                      model: true,
                      imei: true,
                    },
                  },
                },
              }),
            ]);

            overview.qc = {
              assignedPendingCount,
              inspectedTodayCount,
              assignedDevices,
              recentInspections: recentInspections.map((i) => ({
                id: i.id,
                deviceModel: i.device.model,
                imei: i.device.imei,
                result: i.result,
                grade: i.grade,
                batteryHealth: i.batteryHealth,
                reviewedAt: i.reviewedAt,
              })),
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching QC data:", e);
          }
        })()
      );
    }

    // 6. REPARACIONES (Taller)
    if (moduleSet.has("reparaciones") || roleCode === "TECNICO") {
      fetchers.push(
        (async () => {
          try {
            const [pendingJobs, completedCount, recentJobs] = await Promise.all([
              prisma.repairJob.findMany({
                where: { technicianId: userId, status: "PENDING_PAYMENT" },
                select: { montoTotal: true },
              }),
              prisma.repairJob.count({
                where: { technicianId: userId, status: "PAID" },
              }),
              prisma.repairJob.findMany({
                where: { technicianId: userId },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  jobCode: true,
                  totalEquipos: true,
                  montoTotal: true,
                  status: true,
                  createdAt: true,
                },
              }),
            ]);

            overview.repairs = {
              pendingApprovalCount: pendingJobs.length,
              completedCount,
              totalPendingAmount: pendingJobs.reduce((sum, job) => sum + Number(job.montoTotal), 0),
              recentJobs: recentJobs.map((j) => ({
                id: j.id,
                jobCode: j.jobCode,
                totalEquipos: j.totalEquipos,
                montoTotal: Number(j.montoTotal),
                status: j.status,
                createdAt: j.createdAt,
              })),
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching repairs data:", e);
          }
        })()
      );
    }

    // 7. DESBLOQUEOS
    if (moduleSet.has("desbloqueos") || roleCode === "TECNICO") {
      fetchers.push(
        (async () => {
          try {
            const [pendingRequests, approvedCount, recentRequests] = await Promise.all([
              prisma.unlockRequest.findMany({
                where: { technicianId: userId, status: "PENDING_ADMIN" },
                select: { montoTotalPagado: true, totalEquipos: true, montoPorEquipo: true },
              }),
              prisma.unlockRequest.count({
                where: { technicianId: userId, status: "APPROVED" },
              }),
              prisma.unlockRequest.findMany({
                where: { technicianId: userId },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  requestCode: true,
                  model: true,
                  totalEquipos: true,
                  montoTotalPagado: true,
                  montoPorEquipo: true,
                  status: true,
                  createdAt: true,
                },
              }),
            ]);

            const totalPendingAmount = pendingRequests.reduce((sum, req) => {
              const amount = Number(req.montoTotalPagado) > 0
                ? Number(req.montoTotalPagado)
                : Number(req.totalEquipos) * Number(req.montoPorEquipo);
              return sum + amount;
            }, 0);

            overview.unlocks = {
              pendingCount: pendingRequests.length,
              approvedCount,
              totalPendingAmount,
              recentRequests: recentRequests.map((r) => ({
                id: r.id,
                requestCode: r.requestCode,
                model: r.model,
                totalEquipos: r.totalEquipos,
                montoTotalPagado: Number(r.montoTotalPagado) > 0
                  ? Number(r.montoTotalPagado)
                  : Number(r.totalEquipos) * Number(r.montoPorEquipo),
                status: r.status,
                createdAt: r.createdAt,
              })),
            };
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching unlocks data:", e);
          }
        })()
      );
    }

    // 8. WALLET
    if (moduleSet.has("wallet") || roleCode === "TECNICO") {
      fetchers.push(
        (async () => {
          try {
            const [wallet, recentEntries] = await Promise.all([
              prisma.wallet.findUnique({
                where: { userId },
                select: { balance: true },
              }),
              prisma.walletLedgerEntry.findMany({
                where: { wallet: { userId } },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  amount: true,
                  description: true,
                  type: true,
                  createdAt: true,
                },
              }),
            ]);

            if (wallet) {
              overview.wallet = {
                balance: Number(wallet.balance),
                recentTransactions: recentEntries.map((e) => ({
                  id: e.id,
                  amount: Number(e.amount),
                  description: e.description || "Transacción de billetera",
                  type: e.type,
                  createdAt: e.createdAt,
                })),
              };
            }
          } catch (e) {
            console.error("[getUserOperationsOverview] Error fetching wallet data:", e);
          }
        })()
      );
    }

    await Promise.all(fetchers);

    return overview;
  }
);
