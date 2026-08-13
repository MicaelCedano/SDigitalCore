type ExportBatch = {
  batchNumber: string;
  supplierName?: string | null;
  branch?: string | null;
  receivedAt?: string | Date | null;
  status?: string | null;
  devices: Array<{
    imei?: string | null;
    serialNumber?: string | null;
    brand?: string | null;
    model: string;
    color?: string | null;
    storageGb?: number | null;
    status?: string | null;
    inspections?: Array<{
      status?: string | null;
      result?: string | null;
      grade?: string | null;
      batteryHealth?: number | null;
      functionalityNotes?: string | null;
      physicalNotes?: string | null;
      reviewerNameSnapshot?: string | null;
      reviewedAt?: string | Date | null;
    }>;
  }>;
};

const resultLabels: Record<string, string> = {
  FUNCTIONAL: "FUNCIONAL",
  NON_FUNCTIONAL: "DEFECTUOSO",
};

/** Exporta una compra QC con el mismo formato .xls del exportador de conteos. */
export function exportRevisionBatchToExcel(batch: ExportBatch) {
  const formattedDate = batch.receivedAt
    ? new Date(batch.receivedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })
    : "";

  const rows = batch.devices
    .map((device, index) => {
      const inspection = device.inspections?.[0];
      const reviewed = inspection?.status === "COMPLETED";
      const result = reviewed ? resultLabels[inspection?.result || ""] || inspection?.result || "" : "PENDIENTE";
      const resultColor = result === "FUNCIONAL" ? "#16a34a" : result === "DEFECTUOSO" ? "#dc2626" : "#ca8a04";
      const identifier = device.imei || device.serialNumber || "-";
      const model = `${device.brand || ""} ${device.model}`.trim();

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${index + 1}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; font-family:monospace;">${escapeXml(identifier)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left; font-weight:bold;">${escapeXml(model)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${escapeXml(device.color || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${device.storageGb ?? "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${escapeXml(device.status || "-")}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold; color:${resultColor};">${escapeXml(result)}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${reviewed ? escapeXml(inspection?.grade || "-") : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${reviewed && inspection?.batteryHealth != null ? `${inspection.batteryHealth}%` : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${reviewed ? escapeXml(inspection?.reviewerNameSnapshot || "-") : "-"}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:left;">${reviewed ? escapeXml(inspection?.functionalityNotes || inspection?.physicalNotes || "-") : "-"}</td>
        </tr>
      `;
    })
    .join("");

  const reviewedCount = batch.devices.filter((device) => device.inspections?.[0]?.status === "COMPLETED").length;
  const functionalCount = batch.devices.filter((device) => device.inspections?.[0]?.status === "COMPLETED" && device.inspections?.[0]?.result === "FUNCTIONAL").length;
  const nonFunctionalCount = batch.devices.filter((device) => device.inspections?.[0]?.status === "COMPLETED" && device.inspections?.[0]?.result === "NON_FUNCTIONAL").length;

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
          <tr><td colspan="11" class="header-title" style="padding-bottom:10px;">INFORME DE CONTROL DE CALIDAD â€” SDigitalCore</td></tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Folio:</td><td style="font-weight:bold; color:#5750f1;">${escapeXml(batch.batchNumber)}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Proveedor:</td><td colspan="3">${escapeXml(batch.supplierName || "-")}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Fecha:</td><td colspan="4">${escapeXml(formattedDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; background-color:#f1f5f9;">Sucursal:</td><td>${escapeXml(batch.branch || "-")}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Estado:</td><td colspan="3">${escapeXml(batch.status || "-")}</td>
            <td style="font-weight:bold; background-color:#f1f5f9;">Total:</td><td colspan="4">${batch.devices.length}</td>
          </tr>
          <tr><td colspan="11"></td></tr>
          <thead>
            <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold;">
              <th style="padding:10px; border:1px solid #0f172a;">#</th>
              <th style="padding:10px; border:1px solid #0f172a;">IMEI / Serie</th>
              <th style="padding:10px; border:1px solid #0f172a;">Modelo</th>
              <th style="padding:10px; border:1px solid #0f172a;">Color</th>
              <th style="padding:10px; border:1px solid #0f172a;">Capacidad (GB)</th>
              <th style="padding:10px; border:1px solid #0f172a;">Estado operativo</th>
              <th style="padding:10px; border:1px solid #0f172a;">Resultado QC</th>
              <th style="padding:10px; border:1px solid #0f172a;">Grado</th>
              <th style="padding:10px; border:1px solid #0f172a;">BaterÃ­a</th>
              <th style="padding:10px; border:1px solid #0f172a;">Revisor QC</th>
              <th style="padding:10px; border:1px solid #0f172a;">Observaciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background-color:#f8fafc; font-weight:bold;">
              <td colspan="5" style="border:1px solid #cbd5e1; padding:8px; text-align:right;">TOTALES:</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${batch.devices.length}</td>
              <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${reviewedCount} revisados</td>
              <td colspan="2" style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#16a34a;">${functionalCount} funcionales</td>
              <td colspan="2" style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:#dc2626;">${nonFunctionalCount} defectuosos</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  downloadBlob(htmlContent, `Compra_QC_${batch.batchNumber}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
