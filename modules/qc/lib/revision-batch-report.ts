export type RevisionBatchReport = {
  batchNumber: string;
  supplierName?: string | null;
  branch?: string | null;
  receivedAt?: string | Date | null;
  status?: string | null;
  devices: ReportDevice[];
};

type ReportDevice = {
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

const resultLabels = new Map([
  ["FUNCTIONAL", "FUNCIONAL"],
  ["NON_FUNCTIONAL", "DEFECTUOSO"],
]);

export const qcReportColumns = [
  "#", "IMEI / Serie", "Marca", "Modelo", "Capacidad (GB)", "Resultado QC", "Grado", "Batería", "Observaciones",
];

export function sortQcDevicesByModel(devices: ReportDevice[]): ReportDevice[] {
  return devices
    .map((device, index) => ({ device, index, model: normalizeModelName(device.model) }))
    .sort((a, b) => {
      const modelComparison = a.model.localeCompare(b.model, "es-DO", { numeric: true, sensitivity: "base" });
      return modelComparison || a.index - b.index;
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

export function getRevisionBatchReport(batch: RevisionBatchReport) {
  const date = batch.receivedAt ? new Date(batch.receivedAt) : null;
  const formattedDate = date && Number.isFinite(date.getTime())
    ? date.toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Santo_Domingo",
    }).replace(/[\u00a0\u202f]/g, " ")
    : "";

  const totals = { devices: batch.devices.length, reviewed: 0, functional: 0, nonFunctional: 0 };
  const rows = sortQcDevicesByModel(batch.devices).map((device, index) => {
    const inspection = device.inspections?.[0];
    const reviewed = inspection?.status === "COMPLETED";
    const result = inspection?.result ?? "";
    if (reviewed) {
      totals.reviewed += 1;
      if (result === "FUNCTIONAL") totals.functional += 1;
      if (result === "NON_FUNCTIONAL") totals.nonFunctional += 1;
    }

    return {
      index: index + 1,
      // Un IMEI o una serie deben conservarse como texto, incluidos los ceros iniciales.
      identifier: String(device.imei || device.serialNumber || "-"),
      brand: device.brand || "-",
      model: device.model,
      storage: device.storageGb ?? "-",
      result: reviewed ? resultLabels.get(result) ?? result : "PENDIENTE",
      grade: reviewed ? inspection.grade || "-" : "-",
      battery: reviewed && inspection.batteryHealth != null ? `${inspection.batteryHealth}%` : "-",
      notes: reviewed ? inspection.functionalityNotes || inspection.physicalNotes || "-" : "-",
    };
  });

  return { formattedDate, rows, totals };
}
