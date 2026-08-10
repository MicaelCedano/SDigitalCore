"use client";

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
 * Exporta un recibo individual a un archivo formateado de Excel (.xls / Spreadsheet XML)
 */
export function exportSingleReceiptToExcel(data: GoodsReceiptExportData) {
  const formattedDate = new Date(data.receivedAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let totalItemsCount = 0;
  let totalAmount = 0;

  const detailedImeis = extractDetailedImeis(data.items);

  const itemsRows = data.items
    .map((item, index) => {
      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const subtotal = qty * price;
      totalItemsCount += qty;
      totalAmount += subtotal;

      // Obtener todos los IMEIs de este ítem
      const itemImeis = parseImeiList(item.imeiOrSerial);
      if (itemImeis.length === 0 && item.colorVariants) {
        item.colorVariants.forEach((v) => {
          itemImeis.push(...parseImeiList(v.imeis));
        });
      }

      // Formato celda IMEI: salto de línea interno en Excel
      const imeisHtml =
        itemImeis.length > 0
          ? itemImeis.map((i) => escapeXml(i)).join('<br style="mso-data-placement:same-cell;"/>')
          : "-";

      const bgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";

      return `
        <tr style="background-color: ${bgColor};">
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; vertical-align:top;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; vertical-align:top; mso-number-format:'\\@';">${escapeXml(item.code || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; vertical-align:top; font-weight:bold;">${escapeXml(item.description)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; vertical-align:top; font-weight:bold;">${qty}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; vertical-align:top;">${escapeXml(item.condition || "Nuevo")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right; vertical-align:top;">${price > 0 ? "RD$ " + price.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right; vertical-align:top;">${subtotal > 0 ? "RD$ " + subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; vertical-align:top; font-family:Consolas, 'Courier New', monospace; mso-number-format:'\\@'; white-space:pre-wrap;">${imeisHtml}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; vertical-align:top;">${escapeXml(item.notes || "-")}</td>
        </tr>
      `;
    })
    .join("");

  // Filas para la tabla desglosada de IMEIs (para copiado directo en vertical)
  const imeiDetailRows = detailedImeis
    .map((row, index) => {
      const bgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `
        <tr style="background-color: ${bgColor};">
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${row.index}</td>
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left; mso-number-format:'\\@';">${escapeXml(row.code)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left; font-weight:bold;">${escapeXml(row.description)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; color:#475569;">${escapeXml(row.color)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left; font-family:Consolas, 'Courier New', monospace; font-weight:bold; color:#0f172a; mso-number-format:'\\@';">${escapeXml(row.imei)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${escapeXml(row.condition)}</td>
        </tr>
      `;
    })
    .join("");

  const statusLabel =
    data.status === "COMPLETED" ? "COMPLETADO" : data.status === "DRAFT" ? "BORRADOR" : "CANCELADO";
  const statusColor =
    data.status === "COMPLETED" ? "#16a34a" : data.status === "DRAFT" ? "#ca8a04" : "#dc2626";

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Recibo ${escapeXml(data.receiptNumber)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, Segoe UI, sans-serif; font-size: 13px; color: #1e293b; }
          .header-title { font-size: 22px; font-weight: bold; color: #0f172a; background-color: #f1f5f9; padding: 12px; }
          .section-title { font-size: 15px; font-weight: bold; color: #1e293b; background-color: #cbd5e1; padding: 8px; }
        </style>
      </head>
      <body>
        <table style="border-collapse:collapse; width:100%;">
          <colgroup>
            <col style="width: 45px;" />
            <col style="width: 130px;" />
            <col style="width: 260px;" />
            <col style="width: 60px;" />
            <col style="width: 90px;" />
            <col style="width: 120px;" />
            <col style="width: 130px;" />
            <col style="width: 220px;" />
            <col style="width: 180px;" />
          </colgroup>
          <tr>
            <td colspan="9" class="header-title" style="border: 1px solid #cbd5e1; text-align: center;">
              RECIBO DE MERCANCÍA — SDIGITAL CORE
            </td>
          </tr>
          <tr><td colspan="9" style="height: 8px;"></td></tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Folio Recibo:</td>
            <td style="font-weight:bold; color:#2563eb; border:1px solid #cbd5e1; padding:6px; mso-number-format:'\\@';">${escapeXml(data.receiptNumber)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Proveedor:</td>
            <td colspan="2" style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(data.supplierName)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Fecha Recibo:</td>
            <td colspan="3" style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(formattedDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Sucursal:</td>
            <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(data.branch)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Recibido Por:</td>
            <td colspan="2" style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(data.receivedBy)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Estado:</td>
            <td colspan="3" style="font-weight:bold; color: ${statusColor}; border:1px solid #cbd5e1; padding:6px;">
              ${statusLabel}
            </td>
          </tr>
          ${
            data.notes
              ? `
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9; border:1px solid #cbd5e1; padding:6px;">Observaciones:</td>
            <td colspan="8" style="font-style:italic; border:1px solid #cbd5e1; padding:6px;">${escapeXml(data.notes)}</td>
          </tr>
          `
              : ""
          }
          <tr><td colspan="9" style="height: 12px;"></td></tr>
          
          <!-- RESUMEN DE PRODUCTOS -->
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center;">
              <th style="padding:10px; border:1px solid #0f172a;">#</th>
              <th style="padding:10px; border:1px solid #0f172a;">SKU / Código</th>
              <th style="padding:10px; border:1px solid #0f172a;">Descripción / Producto</th>
              <th style="padding:10px; border:1px solid #0f172a;">Cant.</th>
              <th style="padding:10px; border:1px solid #0f172a;">Condición</th>
              <th style="padding:10px; border:1px solid #0f172a;">Precio Unit.</th>
              <th style="padding:10px; border:1px solid #0f172a;">Subtotal</th>
              <th style="padding:10px; border:1px solid #0f172a;">IMEIs / Series</th>
              <th style="padding:10px; border:1px solid #0f172a;">Notas del Ítem</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr style="background-color:#e2e8f0; font-weight:bold;">
              <td colspan="3" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">TOTALES GENERALES:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#2563eb; font-size:14px;">${totalItemsCount}</td>
              <td colspan="2" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">MONTO TOTAL:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:right; color:#16a34a; font-size:14px;">
                ${totalAmount > 0 ? "RD$ " + totalAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}
              </td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#0f172a;">${detailedImeis.length} IMEIs regist.</td>
              <td style="border:1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>

        ${
          detailedImeis.length > 0
            ? `
        <br/><br/>
        <!-- TABLA DESGLOSADA DE IMEIS (COPIADO VERTICAL RÁPIDO) -->
        <table style="border-collapse:collapse; width:100%;">
          <colgroup>
            <col style="width: 45px;" />
            <col style="width: 130px;" />
            <col style="width: 260px;" />
            <col style="width: 110px;" />
            <col style="width: 220px;" />
            <col style="width: 90px;" />
          </colgroup>
          <tr>
            <td colspan="6" class="section-title" style="border:1px solid #cbd5e1;">
              LISTADO DESGLOSADO DE IMEIS / SERIES (SECCIÓN PARA COPIADO DIRECTO EN VERTICAL)
            </td>
          </tr>
          <thead>
            <tr style="background-color: #334155; color: #ffffff; font-weight: bold; text-align: center;">
              <th style="padding:8px; border:1px solid #334155;">#</th>
              <th style="padding:8px; border:1px solid #334155;">SKU / Código</th>
              <th style="padding:8px; border:1px solid #334155;">Producto</th>
              <th style="padding:8px; border:1px solid #334155;">Color / Variante</th>
              <th style="padding:8px; border:1px solid #334155; background-color:#1e293b;">IMEI / Serie (Copiar columna)</th>
              <th style="padding:8px; border:1px solid #334155;">Condición</th>
            </tr>
          </thead>
          <tbody>
            ${imeiDetailRows}
          </tbody>
        </table>
        `
            : ""
        }
      </body>
    </html>
  `;

  downloadBlob(htmlContent, `Recibo_${data.receiptNumber}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

/**
 * Exporta el listado consolidado de recibos de mercancía a Excel
 */
export function exportReceiptListToExcel(receipts: GoodsReceiptExportData[]) {
  let totalGlobalUnits = 0;
  let totalGlobalImeis = 0;

  const rows = receipts
    .map((r, index) => {
      const formattedDate = new Date(r.receivedAt).toLocaleDateString("es-DO");
      const totalQty = r.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      const detailedImeis = extractDetailedImeis(r.items);
      const totalIMEIs = detailedImeis.length;

      totalGlobalUnits += totalQty;
      totalGlobalImeis += totalIMEIs;

      const bgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const statusColor = r.status === "COMPLETED" ? "#16a34a" : r.status === "DRAFT" ? "#ca8a04" : "#dc2626";

      return `
        <tr style="background-color:${bgColor};">
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:#2563eb; mso-number-format:'\\@';">${escapeXml(r.receiptNumber)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${escapeXml(formattedDate)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeXml(r.supplierName)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(r.branch)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold;">${totalQty}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; color:#0f172a;">${totalIMEIs}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; color:${statusColor}">${r.status === "COMPLETED" ? "COMPLETADO" : r.status === "DRAFT" ? "BORRADOR" : "CANCELADO"}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(r.receivedBy)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(r.notes || "")}</td>
        </tr>
      `;
    })
    .join("");

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, Segoe UI, sans-serif; font-size: 12px; color: #1e293b; }
          th { background-color: #0f172a; color: #ffffff; padding: 8px; border: 1px solid #0f172a; }
        </style>
      </head>
      <body>
        <h2 style="color:#0f172a;">HISTORIAL DE RECIBOS DE MERCANCÍA — SDIGITAL CORE</h2>
        <p style="color:#64748b; font-size:11px;">Generado el: ${new Date().toLocaleString("es-DO")}</p>
        <table style="border-collapse:collapse; width:100%;">
          <colgroup>
            <col style="width: 40px;" />
            <col style="width: 120px;" />
            <col style="width: 90px;" />
            <col style="width: 200px;" />
            <col style="width: 130px;" />
            <col style="width: 100px;" />
            <col style="width: 100px;" />
            <col style="width: 110px;" />
            <col style="width: 140px;" />
            <col style="width: 200px;" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Folio Recibo</th>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Sucursal</th>
              <th>Total Unidades</th>
              <th>Total IMEIs</th>
              <th>Estado</th>
              <th>Registrado Por</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background-color:#e2e8f0; font-weight:bold;">
              <td colspan="5" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">TOTALES CONSOLIDADOS:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#2563eb;">${totalGlobalUnits}</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#0f172a;">${totalGlobalImeis}</td>
              <td colspan="3" style="border:1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  const filename = `Recibos_Mercancia_${new Date().toISOString().slice(0, 10)}.xls`;
  downloadBlob(htmlContent, filename, "application/vnd.ms-excel;charset=utf-8");
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
