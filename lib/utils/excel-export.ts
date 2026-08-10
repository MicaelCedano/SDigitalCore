"use client";

import * as XLSX from "xlsx";

export interface ReceiptColorVariantExport {
  color?: string | null;
  quantity?: number | null;
  imeis?: string | null;
}

export interface GoodsReceiptExportItem {
  code?: string | null;
  description: string;
  quantity: number;
  unitPrice?: number | null;
  condition?: string | null;
  imeiOrSerial?: string | null;
  notes?: string | null;
  colorVariants?: ReceiptColorVariantExport[] | null;
}

export interface GoodsReceiptExportData {
  receiptNumber: string;
  supplierName: string;
  branch: string;
  receivedBy: string;
  status: string;
  notes?: string | null;
  receivedAt: string | Date;
  items: GoodsReceiptExportItem[];
}

export interface DetailedImeiRow {
  index: number;
  code: string;
  description: string;
  color: string;
  imei: string;
  condition: string;
}

/**
 * Convierte cualquier string de IMEIs en un arreglo de IMEIs limpios.
 */
export function parseImeiList(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(/[\r\n,;|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extrae todos los IMEIs individuales de la lista de ítems para la tabla desglosada.
 */
export function extractDetailedImeis(items: GoodsReceiptExportItem[]): DetailedImeiRow[] {
  const result: DetailedImeiRow[] = [];
  let count = 1;

  for (const item of items) {
    const code = item.code || "-";
    const description = item.description || "Producto no especificado";
    const condition = item.condition || "Nuevo";

    // 1. Revisar si hay colorVariants con IMEIs
    if (item.colorVariants && item.colorVariants.length > 0) {
      let foundAnyVariantImeis = false;
      for (const variant of item.colorVariants) {
        const color = variant.color?.trim() || "General";
        const imeis = parseImeiList(variant.imeis);
        for (const imei of imeis) {
          result.push({
            index: count++,
            code,
            description,
            color,
            imei,
            condition,
          });
          foundAnyVariantImeis = true;
        }
      }
      if (foundAnyVariantImeis) continue;
    }

    // 2. Fallback a imeiOrSerial del ítem
    const imeis = parseImeiList(item.imeiOrSerial);
    for (const imei of imeis) {
      result.push({
        index: count++,
        code,
        description,
        color: "General",
        imei,
        condition,
      });
    }
  }

  return result;
}

/**
 * Exporta un recibo individual a un archivo nativo de Excel (.xlsx) sin advertencias
 */
export function exportSingleReceiptToExcel(data: GoodsReceiptExportData) {
  const formattedDate = new Date(data.receivedAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const detailedImeis = extractDetailedImeis(data.items);
  const statusLabel =
    data.status === "COMPLETED" ? "COMPLETADO" : data.status === "DRAFT" ? "BORRADOR" : "CANCELADO";

  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen y Detalle del Recibo
  const sheetData: (string | number | null | undefined)[][] = [
    ["RECIBO DE MERCANCÍA — SDIGITAL CORE"],
    [],
    ["Folio Recibo:", data.receiptNumber, "", "Proveedor:", data.supplierName, "", "Fecha Recibo:", formattedDate],
    ["Sucursal:", data.branch, "", "Recibido Por:", data.receivedBy, "", "Estado:", statusLabel],
  ];

  if (data.notes) {
    sheetData.push(["Observaciones:", data.notes]);
  }

  sheetData.push([]);
  sheetData.push([
    "#",
    "SKU / Código",
    "Descripción / Producto",
    "Cant.",
    "Condición",
    "Precio Unit. (RD$)",
    "Subtotal (RD$)",
    "IMEIs / Series",
    "Notas del Ítem"
  ]);

  let totalItemsCount = 0;
  let totalAmount = 0;

  data.items.forEach((item, index) => {
    const qty = item.quantity || 1;
    const price = item.unitPrice || 0;
    const subtotal = qty * price;
    totalItemsCount += qty;
    totalAmount += subtotal;

    const itemImeis = parseImeiList(item.imeiOrSerial);
    if (itemImeis.length === 0 && item.colorVariants) {
      item.colorVariants.forEach((v) => {
        itemImeis.push(...parseImeiList(v.imeis));
      });
    }

    sheetData.push([
      index + 1,
      String(item.code || "-"),
      item.description,
      qty,
      item.condition || "Nuevo",
      price > 0 ? price : 0,
      subtotal > 0 ? subtotal : 0,
      itemImeis.join("\n"),
      item.notes || "-"
    ]);
  });

  // Fila de Totales
  sheetData.push([]);
  sheetData.push([
    "TOTALES GENERALES:",
    "",
    "",
    totalItemsCount,
    "",
    "MONTO TOTAL:",
    totalAmount,
    `${detailedImeis.length} IMEIs registrados`,
    ""
  ]);

  // Agregar Sección 2 en la misma hoja si hay IMEIs
  if (detailedImeis.length > 0) {
    sheetData.push([]);
    sheetData.push([]);
    sheetData.push(["LISTADO DESGLOSADO DE IMEIS / SERIES (SECCIÓN PARA COPIADO DIRECTO EN VERTICAL)"]);
    sheetData.push([
      "#",
      "SKU / Código",
      "Producto",
      "Color / Variante",
      "IMEI / Serie (Copiar columna)",
      "Condición"
    ]);

    detailedImeis.forEach((row) => {
      sheetData.push([
        row.index,
        String(row.code),
        row.description,
        row.color,
        String(row.imei),
        row.condition
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 35 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 25 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Recibo " + String(data.receiptNumber).slice(0, 20));

  // Hoja 2: "Solo IMEIs" (Para copiado masivo en 1 clic)
  if (detailedImeis.length > 0) {
    const imeiSheetData: (string | number)[][] = [
      ["#", "SKU / Código", "Producto", "Color / Variante", "IMEI / Serie", "Condición"]
    ];

    detailedImeis.forEach((row) => {
      imeiSheetData.push([
        row.index,
        String(row.code),
        row.description,
        row.color,
        String(row.imei),
        row.condition
      ]);
    });

    const wsImeis = XLSX.utils.aoa_to_sheet(imeiSheetData);
    wsImeis["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 32 },
      { wch: 16 },
      { wch: 26 },
      { wch: 14 }
    ];

    XLSX.utils.book_append_sheet(wb, wsImeis, "Solo IMEIs");
  }

  XLSX.writeFile(wb, `Recibo_${data.receiptNumber}.xlsx`);
}

/**
 * Exporta el listado consolidado de recibos de mercancía a un archivo nativo de Excel (.xlsx)
 */
export function exportReceiptListToExcel(receipts: GoodsReceiptExportData[]) {
  const wb = XLSX.utils.book_new();

  const sheetData: (string | number)[][] = [
    ["HISTORIAL DE RECIBOS DE MERCANCÍA — SDIGITAL CORE"],
    [`Generado el: ${new Date().toLocaleString("es-DO")}`],
    [],
    [
      "#",
      "Folio Recibo",
      "Fecha",
      "Proveedor",
      "Sucursal",
      "Total Unidades",
      "Total IMEIs",
      "Estado",
      "Registrado Por",
      "Observaciones"
    ]
  ];

  let totalGlobalUnits = 0;
  let totalGlobalImeis = 0;

  receipts.forEach((r, index) => {
    const formattedDate = new Date(r.receivedAt).toLocaleDateString("es-DO");
    const totalQty = r.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const detailedImeis = extractDetailedImeis(r.items);
    const totalIMEIs = detailedImeis.length;

    totalGlobalUnits += totalQty;
    totalGlobalImeis += totalIMEIs;

    sheetData.push([
      index + 1,
      String(r.receiptNumber),
      formattedDate,
      r.supplierName,
      r.branch,
      totalQty,
      totalIMEIs,
      r.status === "COMPLETED" ? "COMPLETADO" : r.status === "DRAFT" ? "BORRADOR" : "CANCELADO",
      r.receivedBy,
      r.notes || ""
    ]);
  });

  sheetData.push([]);
  sheetData.push([
    "TOTALES CONSOLIDADOS:",
    "",
    "",
    "",
    "",
    totalGlobalUnits,
    totalGlobalImeis,
    "",
    "",
    ""
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 25 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 20 },
    { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Historial Recibos");
  XLSX.writeFile(wb, `Recibos_Mercancia_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
