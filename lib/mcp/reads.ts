import { prisma } from "@/lib/db/prisma";
import { computeVersionHash } from "@/lib/mcp/validation";
import { equipoSnapshot, garantiaSnapshot, iso, loteSnapshot, tareaSnapshot } from "@/lib/mcp/snapshots";

function pack(resultados: unknown[]) {
  return {
    total: resultados.length,
    resultados,
    ...(resultados.length > 1
      ? { advertencia: "Hay varias coincidencias. No elijas una sola automáticamente; confirma con el usuario." }
      : {}),
  };
}

function text(value: string) {
  return value.trim();
}

function money(value: unknown) {
  if (value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function precioVisible<T extends { costPrice: unknown; minPrice: unknown }>(row: T) {
  return {
    ...row,
    precio_costo: money(row.costPrice),
    precio_minimo: money(row.minPrice),
  };
}

const userPick = { id: true, name: true, username: true } as const;

export async function buscarGarantia(query: string, limite: number, estado?: string, incluirArchivados = false) {
  const q = text(query);
  const rows = await prisma.warrantyCase.findMany({
    where: {
      ...(incluirArchivados ? {} : { archivedAt: null }),
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { caseCode: { contains: q, mode: "insensitive" } },
        { imei: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { id: true, caseCode: true, imei: true, model: true, color: true, clientName: true, status: true, entryDate: true, archivedAt: true, updatedAt: true },
  });
  return pack(rows.map((row) => ({ ...row, entryDate: iso(row.entryDate), archivedAt: iso(row.archivedAt), updatedAt: iso(row.updatedAt) })));
}

export async function obtenerGarantia(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.warrantyCase.findFirst({
    where: { OR: [{ id: key }, { caseCode: key }, { caseCode: key.toUpperCase() }] },
    include: {
      assignedTechnician: { select: userPick },
      events: { orderBy: { createdAt: "desc" }, take: 12, select: { type: true, fromStatus: true, toStatus: true, reason: true, counterpartyName: true, createdAt: true } },
    },
  });
  if (!row) throw new Error("No se encontró la garantía.");
  const snapshot = garantiaSnapshot(row);
  return { garantia: { ...snapshot, eventos: row.events.map((event) => ({ ...event, createdAt: iso(event.createdAt) })) }, version_hash: computeVersionHash(snapshot) };
}

export async function buscarTrabajoReparacion(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.repairJob.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { jobCode: { contains: q, mode: "insensitive" } },
        { technician: { name: { contains: q, mode: "insensitive" } } },
        { technician: { username: { contains: q, mode: "insensitive" } } },
        { items: { some: { imei: { contains: q, mode: "insensitive" } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, jobCode: true, status: true, totalEquipos: true, montoPorEquipo: true, montoTotal: true, createdAt: true, technician: { select: userPick } },
  });
  return pack(rows.map((row) => ({ ...row, montoPorEquipo: Number(row.montoPorEquipo), montoTotal: Number(row.montoTotal), createdAt: iso(row.createdAt) })));
}

export async function obtenerTrabajoReparacion(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.repairJob.findFirst({
    where: { OR: [{ id: key }, { jobCode: key }] },
    include: { technician: { select: userPick }, items: { select: { imei: true, marca: true, modelo: true, cliente: true, problema: true, resultado: true } } },
  });
  if (!row) throw new Error("No se encontró el trabajo de reparación.");
  return {
    trabajo: { ...row, montoPorEquipo: Number(row.montoPorEquipo), montoTotal: Number(row.montoTotal), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), approvedAt: iso(row.approvedAt) },
    version_hash: computeVersionHash({ id: row.id, codigo: row.jobCode, estado: row.status, actualizado: iso(row.updatedAt) }),
  };
}

export async function buscarDesbloqueo(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.unlockRequest.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { requestCode: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { technician: { name: { contains: q, mode: "insensitive" } } },
        { technician: { username: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, requestCode: true, model: true, status: true, totalEquipos: true, montoTotalPagado: true, createdAt: true, technician: { select: userPick } },
  });
  let extra: typeof rows = [];
  if (/^\d{6,}$/.test(q)) {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM unlock_request WHERE imeis::text ILIKE ${"%" + q + "%"} LIMIT ${limite}
    `;
    if (ids.length) {
      extra = await prisma.unlockRequest.findMany({
        where: { id: { in: ids.map((item) => item.id) }, ...(estado ? { status: estado as never } : {}) },
        select: { id: true, requestCode: true, model: true, status: true, totalEquipos: true, montoTotalPagado: true, createdAt: true, technician: { select: userPick } },
      });
    }
  }
  const merged = [...rows, ...extra.filter((item) => !rows.some((row) => row.id === item.id))].slice(0, limite);
  return pack(merged.map((row) => ({ ...row, montoTotalPagado: Number(row.montoTotalPagado), createdAt: iso(row.createdAt) })));
}

export async function obtenerDesbloqueo(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.unlockRequest.findFirst({
    where: { OR: [{ id: key }, { requestCode: key }] },
    include: { technician: { select: userPick }, unlockRecords: { select: { imei: true, model: true, paidAt: true } } },
  });
  if (!row) throw new Error("No se encontró la solicitud de desbloqueo.");
  return {
    desbloqueo: {
      ...row,
      montoPorEquipo: Number(row.montoPorEquipo),
      montoTotalPagado: Number(row.montoTotalPagado),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      approvedAt: iso(row.approvedAt),
      unlockRecords: row.unlockRecords.map((record) => ({ ...record, paidAt: iso(record.paidAt) })),
    },
    version_hash: computeVersionHash({ id: row.id, codigo: row.requestCode, estado: row.status, actualizado: iso(row.updatedAt) }),
  };
}

export async function buscarEquipo(query: string, limite: number) {
  const q = text(query);
  const rows = await prisma.deviceUnit.findMany({
    where: {
      OR: [
        { imei: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { id: true, imei: true, serialNumber: true, brand: true, model: true, storageGb: true, color: true, status: true, updatedAt: true, batch: { select: { batchNumber: true, supplierName: true } } },
  });
  return pack(rows.map((row) => ({ ...row, updatedAt: iso(row.updatedAt) })));
}

export async function obtenerEquipo(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.deviceUnit.findFirst({
    where: { OR: [{ id: key }, { imei: key }, { serialNumber: key }] },
    include: {
      batch: { select: { id: true, batchNumber: true, supplierName: true, branch: true, status: true } },
      inspections: {
        where: { status: "COMPLETED" },
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: { id: true, result: true, grade: true, batteryHealth: true, functionalityNotes: true, physicalNotes: true, reviewerNameSnapshot: true, reviewedAt: true, status: true },
      },
    },
  });
  if (!row) throw new Error("No se encontró el equipo.");
  const current = row.inspections[0] ? [row.inspections[0]] : [];
  const snapshot = equipoSnapshot({ ...row, inspections: current });
  return {
    equipo: {
      ...snapshot,
      lote: row.batch,
      inspecciones: row.inspections.map((item) => ({ ...item, reviewedAt: iso(item.reviewedAt) })),
    },
    version_hash: computeVersionHash(snapshot),
  };
}

export async function buscarLoteQc(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.qcRevisionBatch.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { batchNumber: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { branch: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: limite,
    select: { id: true, batchNumber: true, supplierName: true, branch: true, status: true, totalDevices: true, reviewedDevices: true, receivedAt: true },
  });
  return pack(rows.map((row) => ({ ...row, receivedAt: iso(row.receivedAt), avance: row.totalDevices ? Math.round((row.reviewedDevices / row.totalDevices) * 100) : 0 })));
}

export async function obtenerLoteQc(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.qcRevisionBatch.findFirst({
    where: { OR: [{ id: key }, { batchNumber: key }] },
    include: {
      assignedTo: { select: userPick },
      devices: { take: 40, select: { id: true, imei: true, model: true, brand: true, status: true } },
    },
  });
  if (!row) throw new Error("No se encontró el lote QC.");
  const snapshot = loteSnapshot(row);
  return { lote: { ...snapshot, total: row.totalDevices, revisados: row.reviewedDevices, funcionales: row.functionalCount, noFuncionales: row.nonFunctionalCount, sucursal: row.branch, suplidor: row.supplierName, asignado: row.assignedTo, equipos: row.devices }, version_hash: computeVersionHash(snapshot) };
}

export async function buscarProducto(query: string, limite: number) {
  const q = text(query);
  const rows = await prisma.warehouseProduct.findMany({
    where: { OR: [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { id: true, code: true, name: true, brand: true, color: true, capacity: true, boxes: true, looseUnits: true, totalUnits: true, status: true },
  });
  return pack(rows);
}

export async function obtenerProducto(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.warehouseProduct.findFirst({ where: { OR: [{ id: key }, { code: key }] } });
  if (!row) throw new Error("No se encontró el producto.");
  return { producto: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, codigo: row.code, cantidad: row.totalUnits, actualizado: iso(row.updatedAt) }) };
}

export async function buscarSolicitudAlmacen(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.warehouseRequest.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { requestCode: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { branch: { contains: q, mode: "insensitive" } },
        { requestedBy: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, requestCode: true, title: true, branch: true, requestedBy: true, type: true, status: true, createdAt: true },
  });
  return pack(rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) })));
}

export async function obtenerSolicitudAlmacen(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.warehouseRequest.findFirst({
    where: { OR: [{ id: key }, { requestCode: key }] },
    include: { items: { include: { product: { select: { id: true, code: true, name: true, totalUnits: true } } } } },
  });
  if (!row) throw new Error("No se encontró la solicitud de almacén.");
  return { solicitud: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, codigo: row.requestCode, estado: row.status, actualizado: iso(row.updatedAt) }) };
}

export async function buscarRecibo(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.goodsReceipt.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [{ receiptNumber: { contains: q, mode: "insensitive" } }, { supplierName: { contains: q, mode: "insensitive" } }, { branch: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { receivedAt: "desc" },
    take: limite,
    select: { id: true, receiptNumber: true, supplierName: true, branch: true, status: true, receivedAt: true },
  });
  return pack(rows.map((row) => ({ ...row, receivedAt: iso(row.receivedAt) })));
}

export async function obtenerRecibo(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.goodsReceipt.findFirst({ where: { OR: [{ id: key }, { receiptNumber: key }] }, include: { items: true } });
  if (!row) throw new Error("No se encontró el recibo.");
  return { recibo: { ...row, receivedAt: iso(row.receivedAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, codigo: row.receiptNumber, estado: row.status, actualizado: iso(row.updatedAt) }) };
}

export async function buscarConteo(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.stockCount.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [{ countNumber: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { branch: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { startedAt: "desc" },
    take: limite,
    select: { id: true, countNumber: true, title: true, branch: true, status: true, startedAt: true },
  });
  return pack(rows.map((row) => ({ ...row, startedAt: iso(row.startedAt) })));
}

export async function obtenerConteo(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.stockCount.findFirst({ where: { OR: [{ id: key }, { countNumber: key }] }, include: { items: true } });
  if (!row) throw new Error("No se encontró el conteo.");
  return { conteo: { ...row, startedAt: iso(row.startedAt), completedAt: iso(row.completedAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, codigo: row.countNumber, estado: row.status, actualizado: iso(row.updatedAt) }) };
}

export async function buscarFactura(query: string, limite: number, tipo?: string) {
  const q = text(query);
  const rows = await prisma.invoice.findMany({
    where: {
      ...(tipo ? { type: tipo as never } : {}),
      OR: [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { ncf: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, invoiceNumber: true, ncf: true, type: true, clientName: true, total: true, status: true, createdAt: true },
  });
  return pack(rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) })));
}

export async function obtenerFactura(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.invoice.findFirst({ where: { OR: [{ id: key }, { invoiceNumber: key }, { ncf: key }] }, include: { items: true } });
  if (!row) throw new Error("No se encontró la factura.");
  return { factura: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, numero: row.invoiceNumber, total: row.total, actualizado: iso(row.updatedAt) }) };
}

export async function buscarPrecio(query: string, limite: number) {
  const q = text(query);
  const rows = await prisma.priceListItem.findMany({
    where: { OR: [{ model: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { id: true, sku: true, model: true, brand: true, capacity: true, costPrice: true, minPrice: true, wholesalePrice: true, retailPrice: true, status: true, isActive: true },
  });
  return pack(rows.map((row) => precioVisible(row)));
}

export async function obtenerPrecio(idOCodigo: string) {
  const key = text(idOCodigo);
  const row = await prisma.priceListItem.findFirst({ where: { OR: [{ id: key }, { sku: key }, { model: { equals: key, mode: "insensitive" } }] } });
  if (!row) throw new Error("No se encontró el precio.");
  return {
    precio: precioVisible(row),
    version_hash: computeVersionHash({ id: row.id, sku: row.sku, costo: row.costPrice, minimo: row.minPrice, actualizado: iso(row.updatedAt) }),
  };
}

export async function buscarTercero(query: string, limite: number, tipo?: string) {
  const q = text(query);
  const rows = await prisma.businessPartner.findMany({
    where: {
      ...(tipo ? { kind: tipo as never } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { taxId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: limite,
    select: { id: true, name: true, kind: true, taxId: true, phone: true, email: true, status: true },
  });
  return pack(rows);
}

export async function obtenerTercero(idONombre: string) {
  const key = text(idONombre);
  const row = await prisma.businessPartner.findFirst({ where: { OR: [{ id: key }, { name: { equals: key, mode: "insensitive" } }] } });
  if (!row) throw new Error("No se encontró el cliente o suplidor.");
  return { tercero: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, nombre: row.name, actualizado: iso(row.updatedAt) }) };
}

export async function buscarSuplidorQc(query: string, limite: number) {
  const q = text(query);
  const rows = await prisma.qcSupplier.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }] },
    orderBy: { name: "asc" },
    take: limite,
    select: { id: true, name: true, contactName: true, phone: true, email: true, status: true },
  });
  return pack(rows);
}

export async function obtenerSuplidorQc(idONombre: string) {
  const key = text(idONombre);
  const row = await prisma.qcSupplier.findFirst({ where: { OR: [{ id: key }, { name: { equals: key, mode: "insensitive" } }] } });
  if (!row) throw new Error("No se encontró el suplidor QC.");
  return { suplidor: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, nombre: row.name, actualizado: iso(row.updatedAt) }) };
}

export async function buscarSucursal(query: string, limite: number) {
  const q = text(query);
  const rows = await prisma.branch.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] },
    orderBy: { name: "asc" },
    take: limite,
  });
  return pack(rows.map((row) => ({ ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) })));
}

export async function obtenerSucursal(idONombre: string) {
  const key = text(idONombre);
  const row = await prisma.branch.findFirst({ where: { OR: [{ id: key }, { name: { equals: key, mode: "insensitive" } }, { code: key }] } });
  if (!row) throw new Error("No se encontró la sucursal.");
  return { sucursal: { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }, version_hash: computeVersionHash({ id: row.id, nombre: row.name, actualizado: iso(row.updatedAt) }) };
}

export async function buscarTarea(query: string, limite: number, estado?: string) {
  const q = text(query);
  const rows = await prisma.workTask.findMany({
    where: {
      ...(estado ? { status: estado as never } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { sourceCode: { contains: q, mode: "insensitive" } },
        { sourceModule: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { id: true, title: true, status: true, priority: true, kind: true, sourceModule: true, sourceCode: true, dueAt: true, updatedAt: true },
  });
  return pack(rows.map((row) => ({ ...row, dueAt: iso(row.dueAt), updatedAt: iso(row.updatedAt) })));
}

export async function obtenerTarea(id: string) {
  const row = await prisma.workTask.findUnique({
    where: { id: text(id) },
    include: {
      creator: { select: userPick },
      assignee: { select: userPick },
      events: { orderBy: { createdAt: "desc" }, take: 12, select: { type: true, note: true, createdAt: true } },
    },
  });
  if (!row) throw new Error("No se encontró la tarea.");
  const snapshot = tareaSnapshot(row);
  return { tarea: { ...snapshot, modulo: row.sourceModule, codigoOrigen: row.sourceCode, creador: row.creator, responsable: row.assignee, eventos: row.events.map((event) => ({ ...event, createdAt: iso(event.createdAt) })) }, version_hash: computeVersionHash(snapshot) };
}

export async function resumenOperacion() {
  const [garantias, solicitudesPendientes, lotesAbiertos, reparacionesPorPagar, desbloqueosPorAprobar] = await Promise.all([
    prisma.warrantyCase.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }),
    prisma.warehouseRequest.count({ where: { status: "PENDING" } }),
    prisma.qcRevisionBatch.count({ where: { status: { in: ["DRAFT", "PENDING_REVIEW", "IN_REVIEW", "SUBMITTED"] } } }),
    prisma.repairJob.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.unlockRequest.count({ where: { status: "PENDING_ADMIN" } }),
  ]);
  return {
    garantias: garantias.map((row) => ({ estado: row.status, total: row._count._all })),
    solicitudesAlmacenPendientes: solicitudesPendientes,
    lotesQcAbiertos: lotesAbiertos,
    reparacionesPorPagar: reparacionesPorPagar,
    desbloqueosPorAprobar: desbloqueosPorAprobar,
    nota: "Los conteos de pago son solo lectura. Esta versión no mueve dinero ni stock.",
  };
}

export async function avanceLotesQc(query: string | undefined, limite: number) {
  const q = query?.trim();
  const rows = await prisma.qcRevisionBatch.findMany({
    where: q
      ? { OR: [{ batchNumber: { contains: q, mode: "insensitive" } }, { supplierName: { contains: q, mode: "insensitive" } }] }
      : { status: { notIn: ["CANCELLED"] } },
    orderBy: { receivedAt: "desc" },
    take: limite,
    select: { batchNumber: true, supplierName: true, branch: true, status: true, totalDevices: true, reviewedDevices: true, functionalCount: true, nonFunctionalCount: true },
  });
  return pack(rows.map((row) => ({
    ...row,
    porcentajeRevisado: row.totalDevices ? Math.round((row.reviewedDevices / row.totalDevices) * 100) : 0,
    nota: "El porcentaje es de equipos revisados, no de dinero.",
  })));
}

export async function pendientesPago() {
  const [reparaciones, desbloqueos, lotes] = await Promise.all([
    prisma.repairJob.findMany({
      where: { status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { jobCode: true, totalEquipos: true, montoTotal: true, createdAt: true, technician: { select: userPick } },
    }),
    prisma.unlockRequest.findMany({
      where: { status: "PENDING_ADMIN" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { requestCode: true, model: true, totalEquipos: true, montoTotalPagado: true, createdAt: true, technician: { select: userPick } },
    }),
    prisma.qcRevisionBatch.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { updatedAt: "asc" },
      take: 20,
      select: { batchNumber: true, supplierName: true, reviewedDevices: true, totalDevices: true },
    }),
  ]);
  return {
    reparaciones: reparaciones.map((row) => ({ ...row, montoTotal: Number(row.montoTotal), createdAt: iso(row.createdAt) })),
    desbloqueos: desbloqueos.map((row) => ({ ...row, montoTotalPagado: Number(row.montoTotalPagado), createdAt: iso(row.createdAt) })),
    lotesQcEnviados: lotes,
    nota: "Solo consulta. Aprobar estos pendientes acreditaría wallet y no está habilitado.",
  };
}

export async function runRead(name: string, args: Record<string, unknown>) {
  const limite = typeof args.limite === "number" ? args.limite : 5;
  const query = typeof args.query === "string" ? args.query : "";
  const estado = typeof args.estado === "string" ? args.estado : undefined;
  const id = typeof args.id_o_codigo === "string" || typeof args.id_o_codigo === "number" ? String(args.id_o_codigo) : "";
  switch (name) {
    case "buscar_garantia":
      return buscarGarantia(query, limite, estado, args.incluir_archivados === true);
    case "obtener_garantia":
      return obtenerGarantia(id);
    case "buscar_trabajo_reparacion":
      return buscarTrabajoReparacion(query, limite, estado);
    case "obtener_trabajo_reparacion":
      return obtenerTrabajoReparacion(id);
    case "buscar_desbloqueo":
      return buscarDesbloqueo(query, limite, estado);
    case "obtener_desbloqueo":
      return obtenerDesbloqueo(id);
    case "buscar_equipo":
      return buscarEquipo(query, limite);
    case "obtener_equipo":
      return obtenerEquipo(id);
    case "buscar_lote_qc":
      return buscarLoteQc(query, limite, estado);
    case "obtener_lote_qc":
      return obtenerLoteQc(id);
    case "buscar_producto":
      return buscarProducto(query, limite);
    case "obtener_producto":
      return obtenerProducto(id);
    case "buscar_solicitud_almacen":
      return buscarSolicitudAlmacen(query, limite, estado);
    case "obtener_solicitud_almacen":
      return obtenerSolicitudAlmacen(id);
    case "buscar_recibo":
      return buscarRecibo(query, limite, estado);
    case "obtener_recibo":
      return obtenerRecibo(id);
    case "buscar_conteo":
      return buscarConteo(query, limite, estado);
    case "obtener_conteo":
      return obtenerConteo(id);
    case "buscar_factura":
      return buscarFactura(query, limite, typeof args.tipo === "string" ? args.tipo : undefined);
    case "obtener_factura":
      return obtenerFactura(id);
    case "buscar_precio":
      return buscarPrecio(query, limite);
    case "obtener_precio":
      return obtenerPrecio(id);
    case "buscar_tercero":
      return buscarTercero(query, limite, typeof args.tipo === "string" ? args.tipo : undefined);
    case "obtener_tercero":
      return obtenerTercero(id);
    case "buscar_suplidor_qc":
      return buscarSuplidorQc(query, limite);
    case "obtener_suplidor_qc":
      return obtenerSuplidorQc(id);
    case "buscar_sucursal":
      return buscarSucursal(query, limite);
    case "obtener_sucursal":
      return obtenerSucursal(id);
    case "buscar_tarea":
      return buscarTarea(query, limite, estado);
    case "obtener_tarea":
      return obtenerTarea(id);
    case "resumen_operacion":
      return resumenOperacion();
    case "avance_lotes_qc":
      return avanceLotesQc(typeof args.query === "string" ? args.query : undefined, limite);
    case "pendientes_pago":
      return pendientesPago();
    default:
      throw new Error("Lectura desconocida.");
  }
}
