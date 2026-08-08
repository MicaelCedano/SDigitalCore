"use client";

export interface GoodsReceiptExportItem {
  code?: string | null;
  description: string;
  quantity: number;
  unitPrice?: number | null;
  condition?: string | null;
  imeiOrSerial?: string | null;
  notes?: string | null;
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

  const itemsRows = data.items
    .map((item, index) => {
      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const subtotal = qty * price;
      totalItemsCount += qty;
      totalAmount += subtotal;

      const imeis = item.imeiOrSerial ? item.imeiOrSerial.replace(/\n/g, ", ") : "-";

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${escapeXml(item.code || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; font-weight:bold;">${escapeXml(item.description)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold;">${qty}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${escapeXml(item.condition || "Nuevo")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${price > 0 ? "RD$ " + price.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${subtotal > 0 ? "RD$ " + subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; font-family:monospace;">${escapeXml(imeis)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${escapeXml(item.notes || "-")}</td>
        </tr>
      `;
    })
    .join("");

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
          body { font-family: Arial, sans-serif; font-size: 13px; }
          .header-title { font-size: 20px; font-weight: bold; color: #1e293b; }
          .badge { padding: 4px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="9" class="header-title" style="padding-bottom: 10px;">RECIBO DE MERCANCÍA — SDigitalCore</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Folio:</td>
            <td style="font-weight:bold; color:#2563eb;">${escapeXml(data.receiptNumber)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Proveedor:</td>
            <td colspan="2">${escapeXml(data.supplierName)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Fecha:</td>
            <td colspan="3">${escapeXml(formattedDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Sucursal:</td>
            <td>${escapeXml(data.branch)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Recibido Por:</td>
            <td colspan="2">${escapeXml(data.receivedBy)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Estado:</td>
            <td colspan="3" style="font-weight:bold; color: ${data.status === "COMPLETED" ? "#16a34a" : "#ca8a04"};">
              ${data.status === "COMPLETED" ? "COMPLETADO" : data.status === "DRAFT" ? "BORRADOR" : "CANCELADO"}
            </td>
          </tr>
          ${
            data.notes
              ? `
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Observaciones:</td>
            <td colspan="8" style="font-style:italic;">${escapeXml(data.notes)}</td>
          </tr>
          `
              : ""
          }
          <tr><td colspan="9"></td></tr>
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
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
            <tr style="background-color:#f8fafc; font-weight:bold;">
              <td colspan="3" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">TOTALES:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#2563eb;">${totalItemsCount}</td>
              <td colspan="2" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">MONTO TOTAL:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:right; color:#16a34a;">
                ${totalAmount > 0 ? "RD$ " + totalAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 }) : "-"}
              </td>
              <td colspan="2" style="border:1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  downloadBlob(htmlContent, `Recibo_${data.receiptNumber}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

/**
 * Exporta el listado consolidado de recibos de mercancía a Excel
 */
export function exportReceiptListToExcel(receipts: GoodsReceiptExportData[]) {
  const rows = receipts
    .map((r, index) => {
      const formattedDate = new Date(r.receivedAt).toLocaleDateString("es-DO");
      const totalQty = r.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      const totalIMEIs = r.items.filter((item) => !!item.imeiOrSerial).length;

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:#2563eb;">${escapeXml(r.receiptNumber)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(formattedDate)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeXml(r.supplierName)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(r.branch)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${totalQty}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${totalIMEIs}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:${r.status === "COMPLETED" ? "#16a34a" : "#ca8a04"}">${r.status}</td>
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
          body { font-family: Arial, sans-serif; font-size: 12px; }
          th { background-color: #0f172a; color: #ffffff; padding: 8px; border: 1px solid #0f172a; }
        </style>
      </head>
      <body>
        <h2>HISTORIAL DE RECIBOS DE MERCANCÍA — SDigitalCore</h2>
        <p>Generado el: ${new Date().toLocaleString("es-DO")}</p>
        <table border="1">
          <thead>
            <tr>
              <th>#</th>
              <th>Folio Recibo</th>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Sucursal</th>
              <th>Total Unidades</th>
              <th>Ítems con IMEI</th>
              <th>Estado</th>
              <th>Registrado Por</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
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
