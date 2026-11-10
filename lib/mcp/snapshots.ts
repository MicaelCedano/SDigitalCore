export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function garantiaSnapshot(row: {
  id: string;
  caseCode: string;
  clientName: string;
  model: string;
  color: string | null;
  imei: string;
  problem: string;
  status: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  currentSupplierName: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    codigo: row.caseCode,
    cliente: row.clientName,
    modelo: row.model,
    color: row.color,
    imei: row.imei,
    problema: row.problem,
    estado: row.status,
    tecnicoId: row.assignedTechnicianId,
    tecnicoNombre: row.assignedTechnicianName,
    suplidor: row.currentSupplierName,
    archivado: iso(row.archivedAt),
    actualizado: iso(row.updatedAt),
  };
}

export function equipoSnapshot(row: {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string;
  storageGb: number | null;
  color: string | null;
  status: string;
  updatedAt: Date;
  inspections?: { id: string; result: string | null }[];
}) {
  const inspection = row.inspections?.[0];
  return {
    id: row.id,
    imei: row.imei,
    serial: row.serialNumber,
    marca: row.brand,
    modelo: row.model,
    almacenamientoGb: row.storageGb,
    color: row.color,
    estadoOperativo: row.status,
    resultado: inspection?.result ?? null,
    inspeccionId: inspection?.id ?? null,
    actualizado: iso(row.updatedAt),
  };
}

export function loteSnapshot(row: { id: string; batchNumber: string; status: string; notes: string | null; updatedAt: Date }) {
  return {
    id: row.id,
    codigo: row.batchNumber,
    estado: row.status,
    notas: row.notes,
    actualizado: iso(row.updatedAt),
  };
}

export function tareaSnapshot(row: {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: Date | null;
  kind: string;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    titulo: row.title,
    descripcion: row.description,
    prioridad: row.priority,
    estado: row.status,
    vence: row.dueAt ? row.dueAt.toISOString().slice(0, 10) : null,
    tipo: row.kind,
    actualizado: iso(row.updatedAt),
  };
}
