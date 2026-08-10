import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

const searchSchema = z.object({
  q: z.string().trim().regex(/^\d{4,15}$/, "Escribe entre 4 y 15 dígitos."),
});

type GlobalImeiResult = {
  id: string;
  source: "warranty" | "receipt" | "stock-count" | "invoice";
  sourceLabel: string;
  documentNumber: string;
  imei: string;
  title: string;
  detail: string;
  status: string;
  date: string;
  href: string;
};

function findMatchingImei(value: string | null, query: string) {
  if (!value) return query;
  const tokens = value.match(/\d{4,20}/g) ?? [];
  return tokens.find((token) => token.includes(query)) ?? query;
}

export async function GET(request: Request) {
  const user = await getPersistedCurrentUser();
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  }

  const parsed = searchSchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Búsqueda inválida." }, { status: 400 });
  }

  const query = parsed.data.q;
  const isAdmin = user.roleCode === "ADMIN";
  const modules = new Set(user.allowedModules);
  const canSearchWarranties = isAdmin || modules.has("garantias");
  const canSearchWarehouse = isAdmin || modules.has("almacen");
  const canSearchInvoices = isAdmin || modules.has("facturas");

  const [warranties, receiptItems, countItems, invoiceItems] = await Promise.all([
    canSearchWarranties
      ? prisma.warrantyCase.findMany({
          where: { imei: { contains: query } },
          select: { id: true, caseCode: true, imei: true, model: true, clientName: true, status: true, entryDate: true, archivedAt: true },
          orderBy: { createdAt: "desc" },
          take: 6,
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
          take: 6,
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
          take: 6,
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
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  const results: GlobalImeiResult[] = [
    ...warranties.map((item) => ({
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
    ...receiptItems.map((item) => ({
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
    ...countItems.map((item) => ({
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
    ...invoiceItems.map((item) => ({
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
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 18);

  return NextResponse.json({ query, results }, { headers: { "Cache-Control": "no-store" } });
}
