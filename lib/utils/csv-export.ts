export type CsvCell = string | number | boolean | null | undefined;

const CSV_SEPARATOR = ";";

function escapeCsvCell(value: CsvCell) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR))
    .join("\r\n");
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
