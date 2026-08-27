import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

const searchSchema = z.object({
  q: z.string().trim().regex(/^\d{6,15}$/, "Escribe entre 6 y 15 dígitos."),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(5).max(20).default(8),
});

type GlobalImeiResult = {
  id: string;
  source: "warranty" | "receipt" | "stock-count" | "invoice" | "qc" | "repair" | "unlock";
  sourceLabel: string;
  documentNumber: string;
  imei: string;
  title: string;
  detail: string;
  status: string;
  date: string;
  href: string;
  dedupeKey?: string;
};

function findMatchingImei(value: string | null, query: string) {
  if (!value) return query;
  const tokens = value.match(/\d{6,20}/g) ?? [];
  return tokens.find((token) => token.includes(query)) ?? query;
}

export async function GET(request: Request) {
  const user = await getPersistedCurrentUser();
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const parsed = searchSchema.safeParse({
    q: params.get("q") ?? "",
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Búsqueda inválida." }, { status: 400 });
  }

  const { q: query, page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;
  const take = pageSize + 1;
  const isAdmin = user.roleCode === "ADMIN";
  const modules = new Set(user.allowedModules);
  const canSearchWarranties = isAdmin || modules.has("garantias");
  const canSearchWarehouse = isAdmin || modules.has("almacen");
  const canSearchInvoices = isAdmin || modules.has("facturas");
  const canSearchQc = isAdmin || modules.has("qc");
  const canSearchRepairs = isAdmin || modules.has("reparaciones");
  const canSearchUnlocks = isAdmin || modules.has("desbloqueos");

  const [warranties, receiptItems, countItems, invoiceItems, qcInspections, deviceUnits, repairItems, unlockRecords] = await Promise.all([
    canSearchWarranties
      ? prisma.warrantyCase.findMany({
          where: { imei: { contains: query } },
          select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true, entryDate: true, archivedAt: true },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchWarehouse
      ? prisma.goodsReceiptItem.findMany({
          where: { imeiOrSerial: { contains: query } },
          select: {
            id: true,
            description: true,
            imeiOrSerial: true,
            receipt: { select: { receiptNumber: true, supplierName: true, branch: true, status: true, receivedAt: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchWarehouse
      ? prisma.stockCountItem.findMany({
          where: { scannedImeis: { contains: query } },
          select: {
            id: true,
            description: true,
            scannedImeis: true,
            count: { select: { countNumber: true, title: true, branch: true, status: true, startedAt: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchInvoices
      ? prisma.invoiceItem.findMany({
          where: { imeis: { contains: query } },
          select: {
            id: true,
            description: true,
            imeis: true,
            invoice: { select: { invoiceNumber: true, type: true, clientName: true, branch: true, status: true, createdAt: true } },
          },
          orderBy: { invoice: { createdAt: "desc" } },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchQc
      ? prisma.qcInspection.findMany({
          where: {
            status: "COMPLETED",
            corrections: { none: {} },
            device: { imei: { contains: query, mode: "insensitive" } },
          },
          select: {
            id: true,
            result: true,
            reviewedAt: true,
            createdAt: true,
            reviewerNameSnapshot: true,
            device: {
              select: {
                id: true,
                imei: true,
                model: true,
                brand: true,
                batch: { select: { batchNumber: true, supplierName: true } },
              },
            },
          },
          orderBy: { reviewedAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchQc
      ? prisma.deviceUnit.findMany({
          where: { imei: { contains: query, mode: "insensitive" } },
          select: {
            id: true,
            imei: true,
            model: true,
            brand: true,
            status: true,
            sourceSystem: true,
            updatedAt: true,
            batch: { select: { batchNumber: true, supplierName: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchRepairs
      ? prisma.repairJobItem.findMany({
          where: { imei: { contains: query, mode: "insensitive" } },
          select: {
            id: true,
            imei: true,
            marca: true,
            modelo: true,
            cliente: true,
            problema: true,
            createdAt: true,
            job: { select: { jobCode: true, status: true, createdAt: true, technicianId: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
    canSearchUnlocks
      ? prisma.unlockRecord.findMany({
          where: { imei: { contains: query, mode: "insensitive" } },
          select: {
            id: true,
            imei: true,
            model: true,
            paidAt: true,
            request: { select: { requestCode: true, status: true } },
          },
          orderBy: { paidAt: "desc" },
          skip,
          take,
        })
      : Promise.resolve([]),
  ]);

  // Las correcciones y reinspecciones se conservan como historial, pero el
  // rastreo global debe representar una sola vez cada equipo: la última.
  const latestQcByDevice = new Map<string, (typeof qcInspections)[number]>();
  for (const inspection of qcInspections) {
    if (!latestQcByDevice.has(inspection.device.id)) latestQcByDevice.set(inspection.device.id, inspection);
  }
  const latestQcInspections = Array.from(latestQcByDevice.values());
  const qcDeviceIds = new Set(latestQcInspections.map((inspection) => inspection.device.id));
  const deviceOnlyResults = deviceUnits.filter((device) => !qcDeviceIds.has(device.id));

  const hasMore = [warranties, receiptItems, countItems, invoiceItems, qcInspections, deviceUnits, repairItems, unlockRecords]
    .some((items) => items.length > pageSize);
  const pageItems = <T,>(items: T[]) => items.slice(0, pageSize);

  const results: GlobalImeiResult[] = [
    ...pageItems(warranties).map((item) => ({
      id: `warranty-${item.id}`,
      source: "warranty" as const,
      sourceLabel: "Garantía",
      documentNumber: item.caseCode,
      imei: item.imei,
      title: item.model,
      detail: item.clientName,
      status: item.archivedAt ? "ARCHIVADA" : item.status,
      date: item.entryDate.toISOString(),
      href: `/garantias/${encodeURIComponent(item.caseCode)}`,
    })),
    ...pageItems(receiptItems).map((item) => ({
      id: `receipt-${item.id}`,
      source: "receipt" as const,
      sourceLabel: "Recibo de mercancía",
      documentNumber: item.receipt.receiptNumber,
      imei: findMatchingImei(item.imeiOrSerial, query),
      title: item.description,
      detail: `${item.receipt.supplierName} · ${item.receipt.branch}`,
      status: item.receipt.status,
      date: item.receipt.receivedAt.toISOString(),
      href: "/almacen/recibos",
    })),
    ...pageItems(countItems).map((item) => ({
      id: `stock-count-${item.id}`,
      source: "stock-count" as const,
      sourceLabel: "Conteo de stock",
      documentNumber: item.count.countNumber,
      imei: findMatchingImei(item.scannedImeis, query),
      title: item.description,
      detail: `${item.count.title} · ${item.count.branch}`,
      status: item.count.status,
      date: item.count.startedAt.toISOString(),
      href: "/almacen",
    })),
    ...pageItems(invoiceItems).map((item) => ({
      id: `invoice-${item.id}`,
      source: "invoice" as const,
      sourceLabel: item.invoice.type === "CONDUCE" ? "Conduce" : "Factura",
      documentNumber: item.invoice.invoiceNumber,
      imei: findMatchingImei(item.imeis, query),
      title: item.description,
      detail: `${item.invoice.clientName} · ${item.invoice.branch}`,
      status: item.invoice.status,
      date: item.invoice.createdAt.toISOString(),
      href: "/facturas",
    })),
    ...pageItems(latestQcInspections).map((item) => ({
      id: `qc-${item.id}`,
      dedupeKey: `device-${item.device.id}`,
      source: "qc" as const,
      sourceLabel: "Control de calidad",
      documentNumber: item.device.batch?.batchNumber ?? "Equipo revisado",
      imei: item.device.imei ?? query,
      title: `${item.device.brand ? `${item.device.brand} ` : ""}${item.device.model}`,
      detail: `${item.device.batch?.supplierName ?? "Sin suplidor"} · ${item.reviewerNameSnapshot}`,
      status: item.result ?? "COMPLETED",
      date: (item.reviewedAt ?? item.createdAt).toISOString(),
      href: `/qc/equipos-revisados?q=${encodeURIComponent(item.device.imei ?? query)}`,
    })),
    ...pageItems(deviceOnlyResults).map((item) => ({
      id: `device-${item.id}`,
      dedupeKey: `device-${item.id}`,
      source: "qc" as const,
      sourceLabel: item.sourceSystem === "SDIGITALSYSTEM" ? "Equipo legacy" : "Equipo registrado",
      documentNumber: item.batch?.batchNumber ?? "Equipo registrado",
      imei: item.imei ?? query,
      title: `${item.brand ? `${item.brand} ` : ""}${item.model}`,
      detail: `${item.batch?.supplierName ?? "Sin suplidor"} · Estado: ${item.status}`,
      status: item.status,
      date: item.updatedAt.toISOString(),
      href: `/qc/equipos-revisados?q=${encodeURIComponent(item.imei ?? query)}`,
    })),
    ...pageItems(repairItems).map((item) => ({
      id: `repair-${item.id}`,
      source: "repair" as const,
      sourceLabel: "Reparaciones",
      documentNumber: item.job.jobCode,
      imei: item.imei,
      title: item.modelo || item.marca || "Equipo en reparación",
      detail: `${item.cliente} · ${item.problema}`,
      status: item.job.status,
      date: item.createdAt.toISOString(),
       // Solo ADMIN puede llegar al flujo de aprobación/pago desde el buscador.
       // Un técnico, incluido el dueño del trabajo, vuelve a su panel operativo.
       href: isAdmin && item.job.technicianId !== user.id ? "/reparaciones/pagos" : "/reparaciones",
     })),
    ...pageItems(unlockRecords).map((item) => ({
      id: `unlock-${item.id}`,
      source: "unlock" as const,
      sourceLabel: "Desbloqueos",
      documentNumber: item.request.requestCode,
      imei: item.imei,
      title: item.model,
      detail: "IMEI desbloqueado y pagado",
      status: item.request.status,
      date: item.paidAt.toISOString(),
      href: "/desbloqueos/pagos",
    })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    // Cada página trae una ventana por módulo. El cliente puede cargar la siguiente
    // ventana sin ocultar coincidencias detrás de un límite global fijo.

  return NextResponse.json({ query, page, pageSize, hasMore, results }, { headers: { "Cache-Control": "no-store" } });
}
