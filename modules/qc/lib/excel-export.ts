import ExcelJS from "exceljs";
import { getRevisionBatchReport, qcReportColumns, type RevisionBatchReport } from "./revision-batch-report";

export { sortQcDevicesByModel } from "./revision-batch-report";

/** Descarga una compra QC como un libro XLSX real, compatible con Excel. */
export async function exportRevisionBatchToExcel(batch: RevisionBatchReport) {
  const { formattedDate, rows, totals } = getRevisionBatchReport(batch);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SDigitalCore";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Informe QC", {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.columns = [
    { key: "index", width: 7 },
    { key: "identifier", width: 23 },
    { key: "brand", width: 18 },
    { key: "model", width: 30 },
    { key: "storage", width: 16 },
    { key: "result", width: 18 },
    { key: "grade", width: 12 },
    { key: "battery", width: 12 },
    { key: "notes", width: 42 },
  ];

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "INFORME DE CONTROL DE CALIDAD — SDigitalCore";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF1E293B" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  addMetadataRow(sheet, 2, "Folio:", batch.batchNumber, "Proveedor:", batch.supplierName || "-", "Fecha:", formattedDate);
  addMetadataRow(sheet, 3, "Sucursal:", batch.branch || "-", "Estado:", batch.status || "-", "Total:", batch.devices.length);
  sheet.getRow(4).height = 8;

  const headerRow = sheet.getRow(6);
  headerRow.values = qcReportColumns;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder("FF0F172A");
  });

  rows.forEach((data) => {
    const row = sheet.addRow(data);
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
      color: { argb: data.result === "FUNCIONAL" ? "FF16A34A" : data.result === "DEFECTUOSO" ? "FFDC2626" : "FFCA8A04" },
    };
  });

  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "TOTALES:",
    totals.devices,
    `${totals.reviewed} revisados`,
    `${totals.functional} funcionales`,
    "",
    `${totals.nonFunctional} defectuosos`,
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
