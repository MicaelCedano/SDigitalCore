import ExcelJS from "exceljs";

type ExportBatch = {
  batchNumber: string;
  supplierName?: string | null;
  branch?: string | null;
  receivedAt?: string | Date | null;
  status?: string | null;
  devices: ExportDevice[];
};

type ExportDevice = {
  imei?: string | null;
  serialNumber?: string | null;
  brand?: string | null;
  model: string;
  storageGb?: number | null;
  inspections?: Array<{
    status?: string | null;
    result?: string | null;
    grade?: string | null;
    batteryHealth?: number | null;
    functionalityNotes?: string | null;
    physicalNotes?: string | null;
  }>;
};

const resultLabels: Record<string, string> = {
  FUNCTIONAL: "FUNCIONAL",
  NON_FUNCTIONAL: "DEFECTUOSO",
};

/** Ordena los equipos por modelo usando un orden natural para Excel. */
export function sortQcDevicesByModel(devices: ExportDevice[]): ExportDevice[] {
  return devices
    .map((device, index) => ({ device, index }))
    .sort((a, b) => {
      const modelComparison = normalizeModelName(a.device.model).localeCompare(
        normalizeModelName(b.device.model),
        "es-DO",
        { numeric: true, sensitivity: "base" },
      );
      return modelComparison !== 0 ? modelComparison : a.index - b.index;
    })
    .map(({ device }) => device);
}

function normalizeModelName(value: string) {
  return value
    .trim()
    // iPhone X representa la generación 10 y debe ir antes de iPhone 11.
    .replace(/\biphone\s+x\b/gi, "iPhone 10")
    .replace(/\s+/g, " ");
}

/** Descarga una compra QC como un libro XLSX real, compatible con Excel. */
export async function exportRevisionBatchToExcel(batch: ExportBatch) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SDigitalCore";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Informe QC", {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.columns = [
    { header: "#", key: "index", width: 7 },
    { header: "IMEI / Serie", key: "identifier", width: 23 },
    { header: "Marca", key: "brand", width: 18 },
    { header: "Modelo", key: "model", width: 30 },
    { header: "Capacidad (GB)", key: "storage", width: 16 },
    { header: "Resultado QC", key: "result", width: 18 },
    { header: "Grado", key: "grade", width: 12 },
    { header: "Batería", key: "battery", width: 12 },
    { header: "Observaciones", key: "notes", width: 42 },
  ];

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "INFORME DE CONTROL DE CALIDAD — SDigitalCore";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF1E293B" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  const formattedDate = batch.receivedAt
    ? new Date(batch.receivedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })
    : "";
  addMetadataRow(sheet, 2, "Folio:", batch.batchNumber, "Proveedor:", batch.supplierName || "-", "Fecha:", formattedDate);
  addMetadataRow(sheet, 3, "Sucursal:", batch.branch || "-", "Estado:", batch.status || "-", "Total:", batch.devices.length);
  sheet.getRow(4).height = 8;

  const headerRow = sheet.getRow(6);
  headerRow.values = ["#", "IMEI / Serie", "Marca", "Modelo", "Capacidad (GB)", "Resultado QC", "Grado", "Batería", "Observaciones"];
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder("FF0F172A");
  });

  let reviewedCount = 0;
  let functionalCount = 0;
  let nonFunctionalCount = 0;

  const sortedDevices = sortQcDevicesByModel(batch.devices);

  sortedDevices.forEach((device, index) => {
    const inspection = device.inspections?.[0];
    const reviewed = inspection?.status === "COMPLETED";
    const result = reviewed ? resultLabels[inspection?.result || ""] || inspection?.result || "" : "PENDIENTE";
    if (reviewed) reviewedCount += 1;
    if (inspection?.result === "FUNCTIONAL" && reviewed) functionalCount += 1;
    if (inspection?.result === "NON_FUNCTIONAL" && reviewed) nonFunctionalCount += 1;

    const row = sheet.addRow({
      index: index + 1,
      // Los IMEI son identificadores: se escriben como texto para evitar notación científica.
      identifier: String(device.imei || device.serialNumber || "-"),
      brand: device.brand || "-",
      model: device.model,
      storage: device.storageGb ?? "-",
      result,
      grade: reviewed ? inspection?.grade || "-" : "-",
      battery: reviewed && inspection?.batteryHealth != null ? `${inspection.batteryHealth}%` : "-",
      notes: reviewed ? inspection?.functionalityNotes || inspection?.physicalNotes || "-" : "-",
    });
    row.eachCell((cell, columnNumber) => {
      cell.border = thinBorder("FFCBD5E1");
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber === 1 || (columnNumber >= 5 && columnNumber <= 8) ? "center" : "left",
        wrapText: columnNumber === 9,
      };
    });
    row.getCell(2).numFmt = "@";
    row.getCell(6).font = {
      bold: true,
      color: { argb: result === "FUNCIONAL" ? "FF16A34A" : result === "DEFECTUOSO" ? "FFDC2626" : "FFCA8A04" },
    };
  });

  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "TOTALES:",
    batch.devices.length,
    `${reviewedCount} revisados`,
    `${functionalCount} funcionales`,
    "",
    `${nonFunctionalCount} defectuosos`,
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cell.border = thinBorder("FFCBD5E1");
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Compra_QC_${batch.batchNumber}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function addMetadataRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  label1: string,
  value1: string | number,
  label2: string,
  value2: string | number,
  label3: string,
  value3: string | number,
) {
  const row = sheet.getRow(rowNumber);
  row.values = [label1, value1, label2, value2, label3, value3];
  [1, 3, 5].forEach((columnNumber) => {
    const cell = row.getCell(columnNumber);
    cell.font = { bold: true, color: { argb: "FF1E293B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  });
}

function thinBorder(color: string): ExcelJS.Borders {
  return {
    diagonal: {},
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}
