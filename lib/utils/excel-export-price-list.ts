"use client";

export interface PriceListExportItem {
  sku?: string | null;
  model: string;
  category: string;
  brand?: string | null;
  capacity?: string | null;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minPrice?: number | null;
  status: string;
}

/**
 * Exporta la Lista de Precios oficial a Excel (.xls)
 */
export function exportPriceListToExcel(items: PriceListExportItem[]) {
  const formattedDate = new Date().toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = items
    .map((item, index) => {
      const cost = item.costPrice || 0;
      const wholesale = item.wholesalePrice || 0;
      const retail = item.retailPrice || 0;

      const margin = cost > 0 ? (((retail - cost) / cost) * 100).toFixed(1) : "0.0";

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-family:monospace;">${escapeXml(item.sku || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeXml(item.model)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(item.category)}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(item.brand || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:6px;">${escapeXml(item.capacity || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; color:#64748b;">RD$ ${cost.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#0284c7;">RD$ ${wholesale.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#5750f1;">RD$ ${retail.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
          <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; color:#16a34a;">${margin}%</td>
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
          .header-title { font-size: 18px; font-weight: bold; color: #1e293b; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="10" class="header-title" style="padding-bottom: 10px;">LISTA DE PRECIOS OFICIAL — SDigitalCore / La Casita</td>
          </tr>
          <tr>
            <td colspan="10" style="color: #64748b; padding-bottom: 15px;">Generado el: ${escapeXml(formattedDate)}</td>
          </tr>
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
              <th style="padding:8px; border:1px solid #0f172a;">#</th>
              <th style="padding:8px; border:1px solid #0f172a;">SKU / Código</th>
              <th style="padding:8px; border:1px solid #0f172a;">Modelo / Descripción</th>
              <th style="padding:8px; border:1px solid #0f172a;">Categoría</th>
              <th style="padding:8px; border:1px solid #0f172a;">Marca</th>
              <th style="padding:8px; border:1px solid #0f172a;">Capacidad</th>
              <th style="padding:8px; border:1px solid #0f172a;">Costo (RD$)</th>
              <th style="padding:8px; border:1px solid #0f172a;">Por Mayor (RD$)</th>
              <th style="padding:8px; border:1px solid #0f172a;">Detallista (RD$)</th>
              <th style="padding:8px; border:1px solid #0f172a;">% Margen</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(htmlContent, `Lista_Precios_SDigital_${new Date().toISOString().slice(0, 10)}.xls`, "application/vnd.ms-excel;charset=utf-8");
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
