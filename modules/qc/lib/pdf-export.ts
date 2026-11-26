import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { getRevisionBatchReport, qcReportColumns, type RevisionBatchReport } from "./revision-batch-report";

const statusLabels = new Map([
  ["DRAFT", "Borrador"],
  ["PENDING_REVIEW", "Pendiente de QC"],
  ["IN_REVIEW", "En revisión"],
  ["SUBMITTED", "Enviado a aprobación"],
  ["COMPLETED", "Completado"],
  ["CANCELLED", "Cancelado"],
]);

export function createRevisionBatchPdf(batch: RevisionBatchReport) {
  const { formattedDate, rows, totals } = getRevisionBatchReport(batch);
  const pdf = new jsPDF({
    orientation: "landscape",
    format: "letter",
    unit: "mm",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const margin = 12;
  const right = pdf.internal.pageSize.getWidth() - margin;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  const width = right - margin;
  const title = `Informe de control de calidad | ${batch.batchNumber}`;
  pdf.setProperties({ title, creator: "SDigitalCore" });

  pdf.setFont("helvetica", "bold").setFontSize(17).setTextColor(20);
  pdf.text(title, margin, 17);
  pdf.setFont("helvetica", "normal").setFontSize(10);

  const status = batch.status ? statusLabels.get(batch.status) ?? batch.status : "-";
  const metadata: string[] = pdf.splitTextToSize([
    `Proveedor: ${batch.supplierName || "-"}  |  Sucursal: ${batch.branch || "-"}`,
    `Fecha: ${formattedDate || "-"}  |  Estado: ${status}`,
  ].join("\n"), width);
  pdf.text(metadata, margin, 25);

  const summaryY = 25 + metadata.length * 4.1 + 2;
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Total: ${totals.devices}   |   Revisados: ${totals.reviewed}   |   Funcionales: ${totals.functional}   |   Defectuosos: ${totals.nonFunctional}   |   Pendientes: ${totals.devices - totals.reviewed}`,
    margin, summaryY,
  );

  autoTable(pdf, {
    head: [qcReportColumns],
    body: rows.map(({ index, identifier, brand, model, storage, result, grade, battery, notes }) => [
      index, identifier, brand, model, storage, result, grade, battery, notes,
    ]),
    startY: summaryY + 5,
    margin: { top: 22, right: margin, bottom: margin + 6, left: margin },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.7,
      textColor: 20,
      lineColor: 175,
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: { fillColor: 238, textColor: 20, lineColor: 175, lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: 22 },
      3: { cellWidth: 36 },
      4: { cellWidth: 21, halign: "center" },
      5: { cellWidth: 27, fontStyle: "bold" },
      6: { cellWidth: 15, halign: "center" },
      7: { cellWidth: 18, halign: "center" },
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
        pdf.text(title, margin, 16);
      }
    },
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page).setFont("helvetica", "normal").setFontSize(8).setTextColor(60);
    pdf.text("SDigitalCore", margin, bottom);
    pdf.text(`Página ${page} de ${pages}`, right, bottom, { align: "right" });
  }

  return pdf;
}
