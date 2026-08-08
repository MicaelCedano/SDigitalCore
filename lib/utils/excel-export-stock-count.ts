"use client";

export interface StockCountExportItem {
  code?: string | null;
  description: string;
  expectedQty: number;
  countedQty: number;
  difference: number;
  scannedImeis?: string | null;
  notes?: string | null;
}

export interface StockCountExportData {
  countNumber: string;
  title: string;
  branch: string;
  performedBy: string;
  status: string;
  notes?: string | null;
  startedAt: string | Date;
  items: StockCountExportItem[];
}

/**
 * Exporta un conteo de stock individual a Excel (.xls)
 */
export function exportStockCountToExcel(data: StockCountExportData) {
  const formattedDate = new Date(data.startedAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let totalExpected = 0;
  let totalCounted = 0;
  let totalDiff = 0;

  const itemsRows = data.items
    .map((item, index) => {
      const expected = item.expectedQty || 0;
      const counted = item.countedQty || 0;
      const diff = counted - expected;

      totalExpected += expected;
      totalCounted += counted;
      totalDiff += diff;

      const diffColor = diff === 0 ? "#16a34a" : diff > 0 ? "#2563eb" : "#dc2626";
      const diffLabel = diff === 0 ? "0 (OK)" : diff > 0 ? `+${diff} (Sobrante)` : `${diff} (Faltante)`;
      const imeis = item.scannedImeis ? item.scannedImeis.replace(/\n/g, ", ") : "-";

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${escapeXml(item.code || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; font-weight:bold;">${escapeXml(item.description)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${expected}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold;">${counted}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold; color:${diffColor};">${diffLabel}</td>
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
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; }
          .header-title { font-size: 20px; font-weight: bold; color: #1e293b; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="8" class="header-title" style="padding-bottom: 10px;">INFORME DE CONTEO DE STOCK — SDigitalCore</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Folio:</td>
            <td style="font-weight:bold; color:#5750f1;">${escapeXml(data.countNumber)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Título / Tipo:</td>
            <td colspan="2">${escapeXml(data.title)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Fecha:</td>
            <td colspan="2">${escapeXml(formattedDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Sucursal:</td>
            <td>${escapeXml(data.branch)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Auditor:</td>
            <td colspan="2">${escapeXml(data.performedBy)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Estado:</td>
            <td colspan="2" style="font-weight:bold; color: ${data.status === "COMPLETED" ? "#16a34a" : "#ca8a04"};">
              ${data.status === "COMPLETED" ? "COMPLETADO" : "EN PROCESO"}
            </td>
          </tr>
          ${
            data.notes
              ? `
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Notas:</td>
            <td colspan="7" style="font-style:italic;">${escapeXml(data.notes)}</td>
          </tr>
          `
              : ""
          }
          <tr><td colspan="8"></td></tr>
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
              <th style="padding:10px; border:1px solid #0f172a;">#</th>
              <th style="padding:10px; border:1px solid #0f172a;">SKU / Código</th>
              <th style="padding:10px; border:1px solid #0f172a;">Modelo / Descripción</th>
              <th style="padding:10px; border:1px solid #0f172a;">Esperado (Sistema)</th>
              <th style="padding:10px; border:1px solid #0f172a;">Contado (Físico)</th>
              <th style="padding:10px; border:1px solid #0f172a;">Diferencia</th>
              <th style="padding:10px; border:1px solid #0f172a;">IMEIs Escaneados</th>
              <th style="padding:10px; border:1px solid #0f172a;">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr style="background-color:#f8fafc; font-weight:bold;">
              <td colspan="3" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">TOTALES GENERALES:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${totalExpected}</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#5750f1;">${totalCounted}</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:${totalDiff === 0 ? "#16a34a" : "#dc2626"};">
                ${totalDiff > 0 ? `+${totalDiff}` : totalDiff}
              </td>
              <td colspan="2" style="border:1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  downloadBlob(htmlContent, `Conteo_${data.countNumber}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

/**
 * Exporta el listado consolidado de auditorías de conteo a Excel
 */
export function exportStockCountListToExcel(counts: StockCountExportData[]) {
  const rows = counts
    .map((c, index) => {
      const formattedDate = new Date(c.startedAt).toLocaleDateString("es-DO");
      const totalCounted = c.items.reduce((sum, item) => sum + (item.countedQty || 0), 0);
      const totalExpected = c.items.reduce((sum, item) => sum + (item.expectedQty || 0), 0);
      const diff = totalCounted - totalExpected;

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:#5750f1;">${escapeXml(c.countNumber)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(formattedDate)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeXml(c.title)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(c.branch)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${totalExpected}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold;">${totalCounted}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; color:${diff === 0 ? "#16a34a" : "#dc2626"};">${diff > 0 ? `+${diff}` : diff}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(c.performedBy)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:${c.status === "COMPLETED" ? "#16a34a" : "#ca8a04"};">${c.status}</td>
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
        <h2>HISTORIAL DE CONTEOS DE STOCK E INVENTARIO — SDigitalCore</h2>
        <p>Generado el: ${new Date().toLocaleString("es-DO")}</p>
        <table border="1">
          <thead>
            <tr>
              <th>#</th>
              <th>Folio Conteo</th>
              <th>Fecha</th>
              <th>Título / Tipo</th>
              <th>Sucursal</th>
              <th>Esperado Total</th>
              <th>Contado Físico</th>
              <th>Diferencia Total</th>
              <th>Auditor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const filename = `Conteos_Stock_${new Date().toISOString().slice(0, 10)}.xls`;
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
