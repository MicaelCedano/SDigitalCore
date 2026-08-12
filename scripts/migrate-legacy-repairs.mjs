// Migración de reparaciones de Saúl (técnico garantías) desde SDigitalSystem → SDigitalCore.
// Patrón: migrate-legacy-unlocks.mjs (solo LEE de System, escribe en Core, idempotente).
// Fórmula: garantia (tecnico_id=14) agrupada por garantia_lote_ingreso → repair_job + repair_job_item.
// Decisión de Micael (2026-08-12): TODO como historial — todos los jobs status PAID
// (las 926 reparaciones ya fueron pagadas/registradas en System; no se paga nada nuevo).
//
// Uso: node --env-file=.env.local scripts/migrate-legacy-repairs.mjs [--apply]
// (--apply omitido = dry-run)

import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const SOURCE_SYSTEM = "SDIGITALSYSTEM";
const CORE_ADMIN_ID = "dev-admin-001"; // Micael (admin Core)
const CORE_TECHNICIAN_ID = "cmsqatp0f000004ikyi8y1pzv"; // sandy (Saúl, verificado)
const REPAIR_RATE = 150; // tarifa histórica de Saúl en System (monto_por_equipo)
const BATCH_SIZE = 200;

const apply = process.argv.includes("--apply");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en el entorno`);
  return value;
}

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

async function readSource(source) {
  // Garantías de Saúl con su lote de ingreso (TRA/LOTE)
  const items = (await source.query(`
    SELECT
      g.id::text AS "sourceRecordId",
      g.codigo,
      g.lote_ingreso_id::text AS "sourceLoteId",
      g.fecha_recepcion AS "receivedAt",
      g.fecha_reparacion AS "repairedAt",
      g.estado,
      g.cliente,
      g.imei_sn AS imei,
      g.marca,
      g.modelo,
      g.problema,
      g.solucion_aplicada AS solucion
    FROM garantia g
    WHERE g.tecnico_id = 14
    ORDER BY g.id
  `)).rows;

  // Lotes de trabajo (garantia_lote_ingreso) que agrupan esas garantías
  const loteIds = [...new Set(items.map((i) => i.sourceLoteId).filter(Boolean))];
  const lotes = (await source.query(`
    SELECT
      id::text AS "sourceLoteId",
      codigo,
      fecha_creacion AS "createdAt",
      observaciones
    FROM garantia_lote_ingreso
    WHERE id = ANY($1::int[])
    ORDER BY id
  `, [loteIds])).rows;

  const counts = {
    totalItems: items.length,
    byEstado: Object.fromEntries(
      (await source.query(`SELECT estado, COUNT(*)::int AS n FROM garantia WHERE tecnico_id = 14 GROUP BY estado`)).rows.map((r) => [r.estado, r.n])
    ),
  };

  return { items, lotes, counts };
}

async function assertTargetSchema(target) {
  const row = (await target.query(`
    SELECT
      to_regclass('public.repair_job') IS NOT NULL AS jobs,
      to_regclass('public.repair_job_item') IS NOT NULL AS items,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='repair_job' AND column_name='source_record_id') AS job_trace,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='repair_job_item' AND column_name='source_record_id') AS item_trace
  `)).rows[0];
  if (!row.jobs || !row.items || !row.job_trace || !row.item_trace) {
    throw new Error("Falta esquema de trazabilidad (source_system/source_record_id) en repair_job/repair_job_item.");
  }
}

function buildSnapshot(sourceData) {
  const loteBySource = new Map(sourceData.lotes.map((l) => [l.sourceLoteId, l]));
  const jobs = [];
  const items = [];

  // Agrupar items por lote
  const byLote = new Map();
  for (const item of sourceData.items) {
    const key = item.sourceLoteId ?? "sin-lote";
    if (!byLote.has(key)) byLote.set(key, []);
    byLote.get(key).push(item);
  }

  for (const [loteKey, groupItems] of byLote) {
    const lote = loteBySource.get(loteKey);
    const codigo = lote?.codigo ?? `SIN-LOTE-${loteKey}`;
    const jobId = `legacy-sds-repair-${loteKey}`;
    const createdAt = lote?.createdAt ? new Date(lote.createdAt) : new Date();
    // approvedAt = última fecha de reparación del lote (cuando terminó de trabajar)
    const repairedDates = groupItems.map((i) => (i.repairedAt ? new Date(i.repairedAt).getTime() : 0));
    const approvedAt = repairedDates.length > 0 ? new Date(Math.max(...repairedDates)) : createdAt;

    jobs.push({
      id: jobId,
      jobCode: `REP-LEGACY-${codigo}`,
      technicianId: CORE_TECHNICIAN_ID,
      status: "PAID",
      observaciones: clean(lote?.observaciones) ?? "Migrado de SDigitalSystem (historial)",
      totalEquipos: groupItems.length,
      montoPorEquipo: REPAIR_RATE,
      montoTotal: groupItems.length * REPAIR_RATE,
      approvedById: CORE_ADMIN_ID,
      approvedAt,
      createdAt,
      sourceSystem: SOURCE_SYSTEM,
      sourceRecordId: loteKey,
    });

    for (const item of groupItems) {
      items.push({
        id: `legacy-sds-repair-item-${item.sourceRecordId}`,
        jobId,
        imei: clean(item.imei) ?? "—",
        marca: clean(item.marca),
        modelo: clean(item.modelo),
        problema: clean(item.problema) ?? "—",
        cliente: clean(item.cliente) ?? "—",
        warrantyCaseId: null,
        createdAt: item.repairedAt ? new Date(item.repairedAt) : item.receivedAt ? new Date(item.receivedAt) : new Date(),
        sourceSystem: SOURCE_SYSTEM,
        sourceRecordId: item.sourceRecordId,
      });
    }
  }

  return { jobs, items };
}

async function importJobs(target, jobs) {
  let imported = 0;
  for (const chunk of chunks(jobs, BATCH_SIZE)) {
    const result = await target.query(`
      WITH payload AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
          id text, "jobCode" text, "technicianId" text, status text, observaciones text,
          "totalEquipos" int, "montoPorEquipo" numeric, "montoTotal" numeric,
          "approvedById" text, "approvedAt" timestamp, "createdAt" timestamp,
          "sourceSystem" text, "sourceRecordId" text
        )
      )
      INSERT INTO repair_job (
        id, job_code, technician_id, status, observaciones, total_equipos,
        monto_por_equipo, monto_total, approved_by_id, approved_at, created_at,
        updated_at, source_system, source_record_id
      )
      SELECT
        id, "jobCode", "technicianId", status::"repair_job_status", observaciones,
        "totalEquipos", "montoPorEquipo", "montoTotal", "approvedById", "approvedAt",
        "createdAt", COALESCE("approvedAt", "createdAt"), "sourceSystem", "sourceRecordId"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        status = EXCLUDED.status,
        total_equipos = EXCLUDED.total_equipos,
        monto_total = EXCLUDED.monto_total,
        approved_at = EXCLUDED.approved_at,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(chunk)]);
    imported += result.rowCount;
  }
  return imported;
}

async function importItems(target, items) {
  let imported = 0;
  for (const chunk of chunks(items, BATCH_SIZE)) {
    const result = await target.query(`
      WITH payload AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
          id text, "jobId" text, imei text, marca text, modelo text, problema text,
          cliente text, "warrantyCaseId" text, "createdAt" timestamp,
          "sourceSystem" text, "sourceRecordId" text
        )
      )
      INSERT INTO repair_job_item (
        id, job_id, imei, marca, modelo, problema, cliente, warranty_case_id,
        created_at, source_system, source_record_id
      )
      SELECT
        id, "jobId", imei, marca, modelo, problema, cliente, "warrantyCaseId",
        "createdAt", "sourceSystem", "sourceRecordId"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        imei = EXCLUDED.imei,
        problema = EXCLUDED.problema,
        cliente = EXCLUDED.cliente,
        marca = EXCLUDED.marca,
        modelo = EXCLUDED.modelo
    `, [JSON.stringify(chunk)]);
    imported += result.rowCount;
  }
  return imported;
}

async function writeAudit(target, summary) {
  await target.query(`
    INSERT INTO audit_log (id, action, module, entity_type, entity_id, after_data, user_agent, created_at)
    VALUES ($1, 'legacy_repairs.import', 'reparaciones', 'legacy_repairs_import', $2, $3::jsonb, 'migration:legacy-repairs', CURRENT_TIMESTAMP)
  `, [crypto.randomUUID(), SOURCE_SYSTEM, JSON.stringify(summary)]);
}

function chunks(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function main() {
  const source = new Client({
    connectionString: requiredEnv("SOURCE_DATABASE_URL"),
    application_name: "sdigitalcore-legacy-repairs-reader",
    connectionTimeoutMillis: 15_000,
  });
  const target = new Client({
    connectionString: requiredEnv("DATABASE_URL"),
    application_name: "sdigitalcore-legacy-repairs-importer",
    connectionTimeoutMillis: 15_000,
  });

  await Promise.all([source.connect(), target.connect()]);
  try {
    const sourceData = await readSource(source);
    const { jobs, items } = buildSnapshot(sourceData);

    const summary = {
      mode: apply ? "APPLY" : "DRY_RUN",
      technician: CORE_TECHNICIAN_ID,
      sourceItems: sourceData.counts.totalItems,
      sourceByEstado: sourceData.counts.byEstado,
      jobs: jobs.length,
      items: items.length,
      montoTotalHistorial: jobs.reduce((acc, j) => acc + j.montoTotal, 0),
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    await assertTargetSchema(target);
    const importedJobs = await importJobs(target, jobs);
    const importedItems = await importItems(target, items);
    await writeAudit(target, { ...summary, importedJobs, importedItems });
    console.log(JSON.stringify({ success: true, importedJobs, importedItems }, null, 2));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
