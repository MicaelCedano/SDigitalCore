"use client";

import ExcelJS from "exceljs";

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
 * Ordena los productos por modelo usando un orden natural.
 *
 * Así, por ejemplo, "iPhone X", "iPhone 11", "iPhone 12"...
 * quedan en el orden esperado en Excel, en vez de ordenarse como texto.
 */
export function sortGoodsReceiptItemsByModel(
  items: GoodsReceiptExportItem[],
): GoodsReceiptExportItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const modelComparison = compareModelNames(a.item.description, b.item.description);
      return modelComparison !== 0 ? modelComparison : a.index - b.index;
    })
    .map(({ item }) => item);
}

function compareModelNames(left: string, right: string) {
  const leftKey = normalizeModelName(left);
  const rightKey = normalizeModelName(right);

  return leftKey.localeCompare(rightKey, "es-DO", {
    numeric: true,
    sensitivity: "base",
  });
}

function normalizeModelName(value: string) {
  return value
    .trim()
    // iPhone X representa la generación 10 y debe ir antes de iPhone 11.
    .replace(/\biphone\s+x\b/gi, "iPhone 10")
    .replace(/\s+/g, " ");
}

/**
 * Convierte cualquier string de IMEIs en un arreglo de IMEIs limpios.
 */
export function parseImeiList(input?: string | null): string[] {
  if (!input) return [];
  return input
    // Acepta el pegado habitual desde Excel/proveedores: espacios, saltos,
    // comas, punto y coma o barras verticales.
    .split(/[\s,;|]+/)
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

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

/**
 * Exporta un recibo individual a un archivo nativo de Excel (.xlsx) con diseño profesional
 */
export async function exportSingleReceiptToExcel(data: GoodsReceiptExportData) {
  const formattedDate = new Date(data.receivedAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const sortedItems = sortGoodsReceiptItemsByModel(data.items);
  const detailedImeis = extractDetailedImeis(sortedItems);
  const statusLabel =
    data.status === "COMPLETED" ? "COMPLETADO" : data.status === "DRAFT" ? "BORRADOR" : "CANCELADO";
  const statusColor =
    data.status === "COMPLETED" ? "FF16A34A" : data.status === "DRAFT" ? "FFCA8A04" : "FFDC2626";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SDigitalCore";

  // --- HOJA 1: Detalle del Recibo ---
  const sheet = workbook.addWorksheet("Recibo", {
    views: [{ showGridLines: true }],
  });

  // Configuración de anchos de columna
  sheet.columns = [
    { key: "col1", width: 6 },   // #
    { key: "col2", width: 18 },  // SKU
    { key: "col3", width: 34 },  // Descripción / Producto
    { key: "col4", width: 10 },  // Cant.
    { key: "col5", width: 14 },  // Condición
    { key: "col6", width: 32 },  // IMEIs / Series
    { key: "col7", width: 30 },  // Observaciones
  ];

  // 1. Título principal
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "RECIBO DE MERCANCÍA — SDIGITAL CORE";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = THIN_BORDER;
  sheet.getRow(1).height = 32;

  // 2. Tarjeta de Metadatos
  const metaLabels = ["Folio Recibo:", "Proveedor:", "Fecha Recibo:", "Sucursal:", "Recibido Por:", "Estado:"];
  
  // Fila 3
  sheet.getCell("A3").value = "Folio Recibo:";
  sheet.getCell("B3").value = String(data.receiptNumber);
  sheet.getCell("B3").font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF2563EB" } };
  sheet.getCell("B3").numFmt = "@";

  sheet.getCell("D3").value = "Proveedor:";
  sheet.getCell("E3").value = data.supplierName;
  sheet.mergeCells("E3:F3");

  sheet.getCell("G3").value = "Fecha Recibo:";
  sheet.getCell("H3").value = formattedDate;
  sheet.mergeCells("H3:I3");

  // Fila 4
  sheet.getCell("A4").value = "Sucursal:";
  sheet.getCell("B4").value = data.branch;

  sheet.getCell("D4").value = "Recibido Por:";
  sheet.getCell("E4").value = data.receivedBy;
  sheet.mergeCells("E4:F4");

  sheet.getCell("G4").value = "Estado:";
  sheet.getCell("H4").value = statusLabel;
  sheet.getCell("H4").font = { name: "Segoe UI", size: 11, bold: true, color: { argb: statusColor } };
  sheet.mergeCells("H4:I4");

  // Estilo etiquetas de metadatos
  ["A3", "D3", "G3", "A4", "D4", "G4"].forEach((cellRef) => {
    const c = sheet.getCell(cellRef);
    c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF334155" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    c.alignment = { horizontal: "left", vertical: "middle" };
  });

  ["B3", "E3", "H3", "B4", "E4", "H4"].forEach((cellRef) => {
    const c = sheet.getCell(cellRef);
    c.alignment = { horizontal: "left", vertical: "middle" };
  });

  let nextRow = 5;
  if (data.notes) {
    sheet.getCell("A5").value = "Observaciones:";
    sheet.getCell("A5").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF334155" } };
    sheet.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    
    sheet.getCell("B5").value = data.notes;
    sheet.getCell("B5").font = { name: "Segoe UI", size: 10, italic: true };
    sheet.mergeCells("B5:I5");
    nextRow = 6;
  }

  // 3. Encabezados Tabla 1: Productos
  const tableHeaderRowIdx = nextRow + 1;
  const headers = [
    "#",
    "SKU / Código",
    "Modelo / Producto",
    "Cant.",
    "Condición",
    "IMEIs / Series",
    "Observaciones",
  ];

  const headerRow = sheet.getRow(tableHeaderRowIdx);
  headerRow.height = 26;

  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = {
      horizontal: colIdx === 0 || colIdx === 3 || colIdx === 4 ? "center" : "left",
      vertical: "middle",
    };
    cell.border = THIN_BORDER;
  });

  // 4. Filas de Ítems
  let currentRowIdx = tableHeaderRowIdx + 1;
  let totalItemsCount = 0;

  sortedItems.forEach((item, index) => {
    const qty = item.quantity || 1;
    totalItemsCount += qty;

    const itemImeis = parseImeiList(item.imeiOrSerial);
    if (itemImeis.length === 0 && item.colorVariants) {
      item.colorVariants.forEach((v) => {
        itemImeis.push(...parseImeiList(v.imeis));
      });
    }

    const row = sheet.getRow(currentRowIdx);
    const isEven = index % 2 === 1;
    const bgFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
    };

    // #
    const c1 = row.getCell(1);
    c1.value = index + 1;
    c1.alignment = { horizontal: "center", vertical: "top" };

    // SKU
    const c2 = row.getCell(2);
    c2.value = String(item.code || "-");
    c2.numFmt = "@";
    c2.alignment = { horizontal: "left", vertical: "top" };

    // Producto
    const c3 = row.getCell(3);
    c3.value = item.description;
    c3.font = { name: "Segoe UI", size: 10, bold: true };
    c3.alignment = { horizontal: "left", vertical: "top" };

    // Cantidad
    const c4 = row.getCell(4);
    c4.value = qty;
    c4.font = { name: "Segoe UI", size: 10, bold: true };
    c4.alignment = { horizontal: "center", vertical: "top" };

    // Condición
    const c5 = row.getCell(5);
    c5.value = item.condition || "Nuevo";
    c5.alignment = { horizontal: "center", vertical: "top" };

    // IMEIs
    const c6 = row.getCell(6);
    c6.value = itemImeis.length > 0 ? itemImeis.join("\n") : "-";
    c6.font = { name: "Consolas", size: 9.5 };
    c6.numFmt = "@";
    c6.alignment = { horizontal: "left", vertical: "top", wrapText: true };

    // Observaciones
    const c7 = row.getCell(7);
    c7.value = item.notes || "-";
    c7.alignment = { horizontal: "left", vertical: "top", wrapText: true };

    // Aplicar estilos a todas las celdas de la fila
    for (let i = 1; i <= 7; i++) {
      const cell = row.getCell(i);
      cell.fill = bgFill;
      cell.border = THIN_BORDER;
    }

    currentRowIdx++;
  });

  // 5. Fila de Totales
  const totalsRow = sheet.getRow(currentRowIdx);
  totalsRow.height = 24;

  sheet.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
  const totLabel = sheet.getCell(`A${currentRowIdx}`);
  totLabel.value = "TOTALES GENERALES:";
  totLabel.font = { name: "Segoe UI", size: 10, bold: true };
  totLabel.alignment = { horizontal: "right", vertical: "middle" };

  const totQty = totalsRow.getCell(4);
  totQty.value = totalItemsCount;
  totQty.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF2563EB" } };
  totQty.alignment = { horizontal: "center", vertical: "middle" };

  const totImeiLabel = totalsRow.getCell(5);
  totImeiLabel.value = "IMEIs registrados:";
  totImeiLabel.font = { name: "Segoe UI", size: 10, bold: true };
  totImeiLabel.alignment = { horizontal: "right", vertical: "middle" };

  const totImeis = totalsRow.getCell(6);
  totImeis.value = `${detailedImeis.length} IMEIs registrados`;
  totImeis.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  totImeis.alignment = { horizontal: "center", vertical: "middle" };

  const totalsBg: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  for (let i = 1; i <= 7; i++) {
    const cell = totalsRow.getCell(i);
    cell.fill = totalsBg;
    cell.border = THIN_BORDER;
  }

  currentRowIdx += 3;

  // 6. Tabla 2: Listado Desglosado de IMEIs (si existen IMEIs)
  if (detailedImeis.length > 0) {
    sheet.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
    const secTitle = sheet.getCell(`A${currentRowIdx}`);
    secTitle.value = "LISTADO DESGLOSADO DE IMEIS / SERIES (SECCIÓN PARA COPIADO DIRECTO EN VERTICAL)";
    secTitle.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
    secTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCBD5E1" } };
    secTitle.alignment = { horizontal: "left", vertical: "middle" };
    secTitle.border = THIN_BORDER;
    sheet.getRow(currentRowIdx).height = 26;

    currentRowIdx++;

    const imeiHeaders = ["#", "SKU / Código", "Producto", "Color / Variante", "IMEI / Serie (Copiar columna)", "Condición"];
    const imeiHeaderRow = sheet.getRow(currentRowIdx);
    imeiHeaderRow.height = 24;

    imeiHeaders.forEach((h, colIdx) => {
      const cell = imeiHeaderRow.getCell(colIdx + 1);
      cell.value = h;
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colIdx === 4 ? "FF1E293B" : "FF334155" } };
      cell.alignment = { horizontal: colIdx === 0 || colIdx === 3 || colIdx === 5 ? "center" : "left", vertical: "middle" };
      cell.border = THIN_BORDER;
    });

    currentRowIdx++;

    detailedImeis.forEach((row, idx) => {
      const imeiRow = sheet.getRow(currentRowIdx);
      const isEven = idx % 2 === 1;
      const bgFill: ExcelJS.Fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
      };

      imeiRow.getCell(1).value = row.index;
      imeiRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      imeiRow.getCell(2).value = String(row.code);
      imeiRow.getCell(2).numFmt = "@";
      imeiRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

      imeiRow.getCell(3).value = row.description;
      imeiRow.getCell(3).font = { name: "Segoe UI", size: 10, bold: true };
      imeiRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

      imeiRow.getCell(4).value = row.color;
      imeiRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

      imeiRow.getCell(5).value = String(row.imei);
      imeiRow.getCell(5).numFmt = "@";
      imeiRow.getCell(5).font = { name: "Consolas", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
      imeiRow.getCell(5).alignment = { horizontal: "left", vertical: "middle" };

      imeiRow.getCell(6).value = row.condition;
      imeiRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

      for (let i = 1; i <= 6; i++) {
        const cell = imeiRow.getCell(i);
        cell.fill = bgFill;
        cell.border = THIN_BORDER;
      }

      currentRowIdx++;
    });
  }

  // --- HOJA 2: "Solo IMEIs" (Lista limpia en 1 clic) ---
  if (detailedImeis.length > 0) {
    const imeiSheet = workbook.addWorksheet("Solo IMEIs", {
      views: [{ showGridLines: true }],
    });

    imeiSheet.columns = [
      { key: "col1", width: 6 },   // #
      { key: "col2", width: 18 },  // SKU
      { key: "col3", width: 34 },  // Producto
      { key: "col4", width: 16 },  // Color
      { key: "col5", width: 28 },  // IMEI
      { key: "col6", width: 14 },  // Condicion
    ];

    const hRow = imeiSheet.getRow(1);
    hRow.height = 26;
    const imeiHeaders = ["#", "SKU / Código", "Producto", "Color / Variante", "IMEI / Serie", "Condición"];

    imeiHeaders.forEach((h, colIdx) => {
      const cell = hRow.getCell(colIdx + 1);
      cell.value = h;
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: colIdx === 0 || colIdx === 3 || colIdx === 5 ? "center" : "left", vertical: "middle" };
      cell.border = THIN_BORDER;
    });

    detailedImeis.forEach((row, idx) => {
      const r = imeiSheet.getRow(idx + 2);
      const isEven = idx % 2 === 1;
      const bgFill: ExcelJS.Fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
      };

      r.getCell(1).value = row.index;
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      r.getCell(2).value = String(row.code);
      r.getCell(2).numFmt = "@";
      r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

      r.getCell(3).value = row.description;
      r.getCell(3).font = { name: "Segoe UI", size: 10, bold: true };
      r.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

      r.getCell(4).value = row.color;
      r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

      r.getCell(5).value = String(row.imei);
      r.getCell(5).numFmt = "@";
      r.getCell(5).font = { name: "Consolas", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
      r.getCell(5).alignment = { horizontal: "left", vertical: "middle" };

      r.getCell(6).value = row.condition;
      r.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

      for (let i = 1; i <= 6; i++) {
        const cell = r.getCell(i);
        cell.fill = bgFill;
        cell.border = THIN_BORDER;
      }
    });
  }

  // Descargar archivo binario .xlsx nativo
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer, `Recibo_${data.receiptNumber}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/**
 * Exporta el listado consolidado de recibos de mercancía a un archivo nativo de Excel (.xlsx)
 */
export async function exportReceiptListToExcel(receipts: GoodsReceiptExportData[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SDigitalCore";

  const sheet = workbook.addWorksheet("Historial Recibos", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { key: "col1", width: 6 },   // #
    { key: "col2", width: 18 },  // Folio
    { key: "col3", width: 14 },  // Fecha
    { key: "col4", width: 25 },  // Proveedor
    { key: "col5", width: 18 },  // Sucursal
    { key: "col6", width: 14 },  // Total Unidades
    { key: "col7", width: 14 },  // Total IMEIs
    { key: "col8", width: 15 },  // Estado
    { key: "col9", width: 20 },  // Registrado Por
    { key: "col10", width: 30 }, // Observaciones
  ];

  // Título
  sheet.mergeCells("A1:J1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "HISTORIAL DE RECIBOS DE MERCANCÍA — SDIGITAL CORE";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = THIN_BORDER;
  sheet.getRow(1).height = 32;

  sheet.getCell("A2").value = `Generado el: ${new Date().toLocaleString("es-DO")}`;
  sheet.getCell("A2").font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };

  // Headers
  const headers = [
    "#",
    "Folio Recibo",
    "Fecha",
    "Proveedor",
    "Sucursal",
    "Total Unidades",
    "Total IMEIs",
    "Estado",
    "Registrado Por",
    "Observaciones",
  ];

  const headerRow = sheet.getRow(4);
  headerRow.height = 26;

  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = {
      horizontal: colIdx === 0 || colIdx === 1 || colIdx === 2 || colIdx === 5 || colIdx === 6 || colIdx === 7 ? "center" : "left",
      vertical: "middle",
    };
    cell.border = THIN_BORDER;
  });

  let totalGlobalUnits = 0;
  let totalGlobalImeis = 0;

  receipts.forEach((r, index) => {
    const formattedDate = new Date(r.receivedAt).toLocaleDateString("es-DO");
    const totalQty = r.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const detailedImeis = extractDetailedImeis(r.items);
    const totalIMEIs = detailedImeis.length;

    totalGlobalUnits += totalQty;
    totalGlobalImeis += totalIMEIs;

    const rowIdx = index + 5;
    const row = sheet.getRow(rowIdx);
    const isEven = index % 2 === 1;
    const bgFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
    };

    row.getCell(1).value = index + 1;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(2).value = String(r.receiptNumber);
    row.getCell(2).numFmt = "@";
    row.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF2563EB" } };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(3).value = formattedDate;
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(4).value = r.supplierName;
    row.getCell(4).font = { name: "Segoe UI", size: 10, bold: true };

    row.getCell(5).value = r.branch;

    row.getCell(6).value = totalQty;
    row.getCell(6).font = { name: "Segoe UI", size: 10, bold: true };
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(7).value = totalIMEIs;
    row.getCell(7).font = { name: "Segoe UI", size: 10, bold: true };
    row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };

    const statusLabel = r.status === "COMPLETED" ? "COMPLETADO" : r.status === "DRAFT" ? "BORRADOR" : "CANCELADO";
    const statusColor = r.status === "COMPLETED" ? "FF16A34A" : r.status === "DRAFT" ? "FFCA8A04" : "FFDC2626";
    row.getCell(8).value = statusLabel;
    row.getCell(8).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: statusColor } };
    row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(9).value = r.receivedBy;
    row.getCell(10).value = r.notes || "";

    for (let i = 1; i <= 10; i++) {
      const cell = row.getCell(i);
      cell.fill = bgFill;
      cell.border = THIN_BORDER;
    }
  });

  // Totales
  const totRowIdx = receipts.length + 5;
  const totRow = sheet.getRow(totRowIdx);
  totRow.height = 24;

  sheet.mergeCells(`A${totRowIdx}:E${totRowIdx}`);
  const totLabel = sheet.getCell(`A${totRowIdx}`);
  totLabel.value = "TOTALES CONSOLIDADOS:";
  totLabel.font = { name: "Segoe UI", size: 10, bold: true };
  totLabel.alignment = { horizontal: "right", vertical: "middle" };

  totRow.getCell(6).value = totalGlobalUnits;
  totRow.getCell(6).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF2563EB" } };
  totRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

  totRow.getCell(7).value = totalGlobalImeis;
  totRow.getCell(7).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
  totRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };

  const totalsBg: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  for (let i = 1; i <= 10; i++) {
    const cell = totRow.getCell(i);
    cell.fill = totalsBg;
    cell.border = THIN_BORDER;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer, `Recibos_Mercancia_${new Date().toISOString().slice(0, 10)}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function downloadBlob(content: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
