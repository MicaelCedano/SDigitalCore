// Migración de desbloqueos desde SDigitalSystem → SDigitalCore.
// Patrón: migrate-legacy-qc-data.mjs (solo LEE de System, escribe en Core, idempotente).
// Fórmula: solicitud_desbloqueo + unlock_record → unlock_request + unlock_record.
//
// Técnicos sin enlace legacy_user_identity (Alberto id5, Yonathan id22) se OMITEN
// en esta pasada; cuando se registren/enlacen, se re-corre el script y entran solos.
//
// Uso: node --env-file=.env.local scripts/migrate-legacy-unlocks.mjs [--apply]
// (--apply omitido = dry-run)

import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const SOURCE_SYSTEM = "SDIGITALSYSTEM";
const CORE_ADMIN_ID = "dev-admin-001"; // Micael (admin Core, verificado)
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
  // Solicitudes con su técnico y admin (nombres del source)
  const requests = (await source.query(`
    SELECT
      s.id::text AS "sourceRecordId",
      s.codigo,
      s.tecnico_id::text AS "sourceTechnicianId",
      s.modelo,
      s.imeis,
      s.estado,
      s.observacion,
      s.admin_id::text AS "sourceAdminId",
      s.fecha_admin AS "approvedAt",
      s.observacion_admin AS "adminObservation",
      s.total_equipos AS "totalEquipos",
      s.equipos_aprobados AS "equiposAprobados",
      s.equipos_rechazados AS "equiposRechazados",
      s.monto_por_equipo AS "montoPorEquipo",
      s.monto_total_pagado AS "montoTotalPagado",
      s.fecha_creacion AS "createdAt"
    FROM solicitud_desbloqueo s
    ORDER BY s.id
  `)).rows;

  // Unlock records
  const records = (await source.query(`
    SELECT
      r.id::text AS "sourceRecordId",
      r.imei,
      r.modelo,
      r.solicitud_id::text AS "sourceRequestId",
      r.tecnico_id::text AS "sourceTechnicianId",
      r.admin_id::text AS "sourceAdminId",
      r.created_at AS "createdAt",
      r.paid_at AS "paidAt"
    FROM unlock_record r
    ORDER BY r.id
  `)).rows;

  const counts = {
    totalRequests: requests.length,
    totalRecords: records.length,
    byStatus: Object.fromEntries(
      (await source.query(`SELECT estado, COUNT(*)::int AS n FROM solicitud_desbloqueo GROUP BY estado`)).rows.map((r) => [r.estado, r.n])
    ),
  };

  return { requests, records, counts };
}

async function readUserLinks(target) {
  const rows = (await target.query(`
    SELECT source_user_id AS "sourceUserId", core_user_id AS "coreUserId"
    FROM legacy_user_identity
    WHERE source_system = $1 AND core_user_id IS NOT NULL
  `, [SOURCE_SYSTEM])).rows;
  return new Map(rows.map((row) => [row.sourceUserId, row.coreUserId]));
}

function mapStatus(sourceStatus) {
  switch (sourceStatus) {
    case "Aprobado": return "APPROVED";
    case "Rechazado": return "REJECTED";
    default: return "PENDING_ADMIN"; // Pendiente Admin / Pendiente QC
  }
}

function mapImeiState(itemState) {
  if (itemState === "Aprobado") return "APPROVED";
  if (itemState === "Rechazado") return "REJECTED";
  return "PENDING";
}

function buildSnapshot(sourceData, userLinks) {
  const requests = [];
  const records = [];
  const skipped = { requests: 0, records: 0, technicians: new Set() };

  const requestIdBySource = new Map();

  for (const req of sourceData.requests) {
    const coreTechnicianId = userLinks.get(req.sourceTechnicianId) ?? null;
    if (!coreTechnicianId) {
      skipped.requests += 1;
      skipped.technicians.add(req.sourceTechnicianId);
      continue;
    }

    const rawImeis = Array.isArray(req.imeis) ? req.imeis : typeof req.imeis === "string" ? JSON.parse(req.imeis) : [];
    const imeis = rawImeis.map((item) => ({
      imei: item.imei,
      estado: mapImeiState(item.estado),
      motivo: clean(item.motivo),
    }));

    const coreRequestId = `legacy-sds-unlock-${req.sourceRecordId}`;
    requestIdBySource.set(req.sourceRecordId, coreRequestId);

    requests.push({
      id: coreRequestId,
      requestCode: req.codigo,
      technicianId: coreTechnicianId,
      model: clean(req.modelo) || "—",
      imeis,
      status: mapStatus(req.estado),
      observacion: clean(req.observacion),
      totalEquipos: Number(req.totalEquipos) || rawImeis.length,
      montoPorEquipo: Number(req.montoPorEquipo) || 25,
      montoTotalPagado: Number(req.montoTotalPagado) || 0,
      adminId: CORE_ADMIN_ID,
      adminObservation: clean(req.adminObservation),
      approvedAt: req.approvedAt ? new Date(req.approvedAt) : null,
      createdAt: req.createdAt ? new Date(req.createdAt) : new Date(),
      sourceSystem: SOURCE_SYSTEM,
      sourceRecordId: req.sourceRecordId,
    });
  }

  for (const rec of sourceData.records) {
    const coreTechnicianId = userLinks.get(rec.sourceTechnicianId) ?? null;
    const coreRequestId = requestIdBySource.get(rec.sourceRequestId);
    if (!coreTechnicianId || !coreRequestId) {
      skipped.records += 1;
      if (!coreTechnicianId) skipped.technicians.add(rec.sourceTechnicianId);
      continue;
    }

    records.push({
      id: `legacy-sds-unlock-rec-${rec.sourceRecordId}`,
      imei: rec.imei,
      model: clean(rec.modelo) || "—",
      requestId: coreRequestId,
      technicianId: coreTechnicianId,
      adminId: CORE_ADMIN_ID,
      createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(),
      paidAt: rec.paidAt ? new Date(rec.paidAt) : new Date(),
      sourceSystem: SOURCE_SYSTEM,
      sourceRecordId: rec.sourceRecordId,
    });
  }

  return { requests, records, skipped };
}

async function assertTargetSchema(target) {
  const row = (await target.query(`
    SELECT
      to_regclass('public.unlock_request') IS NOT NULL AS requests,
      to_regclass('public.unlock_record') IS NOT NULL AS records,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unlock_request' AND column_name='source_record_id') AS req_trace,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unlock_record' AND column_name='source_record_id') AS rec_trace
  `)).rows[0];
  if (!row.requests || !row.records || !row.req_trace || !row.rec_trace) {
    throw new Error("Falta esquema de trazabilidad (source_system/source_record_id) en unlock_request/unlock_record.");
  }
}

async function importRequests(target, requests) {
  let imported = 0;
  for (const chunk of chunks(requests, BATCH_SIZE)) {
    const result = await target.query(`
      WITH payload AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
          id text, "requestCode" text, "technicianId" text, model text,
          imeis jsonb, status text, observacion text, "totalEquipos" int,
          "montoPorEquipo" numeric, "montoTotalPagado" numeric, "adminId" text,
          "adminObservation" text, "approvedAt" timestamp, "createdAt" timestamp,
          "sourceSystem" text, "sourceRecordId" text
        )
      )
      INSERT INTO unlock_request (
        id, request_code, technician_id, model, imeis, status, observacion,
        total_equipos, monto_por_equipo, monto_total_pagado, admin_id, admin_observation,
        approved_at, created_at, updated_at, source_system, source_record_id
      )
      SELECT
        id, "requestCode", "technicianId", model, imeis, status::"unlock_request_status", observacion,
        "totalEquipos", "montoPorEquipo", "montoTotalPagado", "adminId", "adminObservation",
        "approvedAt", "createdAt", COALESCE("approvedAt", "createdAt"), "sourceSystem", "sourceRecordId"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        status = EXCLUDED.status,
        admin_id = EXCLUDED.admin_id,
        admin_observation = EXCLUDED.admin_observation,
        approved_at = EXCLUDED.approved_at,
        monto_total_pagado = EXCLUDED.monto_total_pagado,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(chunk)]);
    imported += result.rowCount;
  }
  return imported;
}

async function importRecords(target, records) {
  let imported = 0;
  for (const chunk of chunks(records, BATCH_SIZE)) {
    const result = await target.query(`
      WITH payload AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
          id text, imei text, model text, "requestId" text, "technicianId" text,
          "adminId" text, "createdAt" timestamp, "paidAt" timestamp,
          "sourceSystem" text, "sourceRecordId" text
        )
      )
      INSERT INTO unlock_record (
        id, imei, model, request_id, technician_id, admin_id, created_at, paid_at,
        source_system, source_record_id
      )
      SELECT
        id, imei, model, "requestId", "technicianId", "adminId", "createdAt", "paidAt",
        "sourceSystem", "sourceRecordId"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        model = EXCLUDED.model,
        admin_id = EXCLUDED.admin_id,
        paid_at = EXCLUDED.paid_at
    `, [JSON.stringify(chunk)]);
    imported += result.rowCount;
  }
  return imported;
}

async function writeAudit(target, summary) {
  await target.query(`
    INSERT INTO audit_log (id, action, module, entity_type, entity_id, after_data, user_agent, created_at)
    VALUES ($1, 'legacy_unlocks.import', 'desbloqueos', 'legacy_unlocks_import', $2, $3::jsonb, 'migration:legacy-unlocks', CURRENT_TIMESTAMP)
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
    application_name: "sdigitalcore-legacy-unlocks-reader",
    connectionTimeoutMillis: 15_000,
  });
  const target = new Client({
    connectionString: requiredEnv("DATABASE_URL"),
    application_name: "sdigitalcore-legacy-unlocks-importer",
    connectionTimeoutMillis: 15_000,
  });

  await Promise.all([source.connect(), target.connect()]);
  try {
    const sourceData = await readSource(source);
    const userLinks = await readUserLinks(target);
    const snapshot = buildSnapshot(sourceData, userLinks);
    const skippedTechnicians = [...snapshot.skipped.technicians];

    const summary = {
      mode: apply ? "APPLY" : "DRY_RUN",
      sourceRequests: sourceData.counts.totalRequests,
      sourceRecords: sourceData.counts.totalRecords,
      sourceByStatus: sourceData.counts.byStatus,
      importedRequests: snapshot.requests.length,
      importedRecords: snapshot.records.length,
      skippedRequests: snapshot.skipped.requests,
      skippedRecords: snapshot.skipped.records,
      skippedTechnicians,
      montoTotalMigrado: snapshot.requests.reduce((acc, r) => acc + r.montoTotalPagado, 0),
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    await assertTargetSchema(target);
    const importedRequests = await importRequests(target, snapshot.requests);
    const importedRecords = await importRecords(target, snapshot.records);
    await writeAudit(target, { ...summary, importedRequests, importedRecords });
    console.log(JSON.stringify({ success: true, importedRequests, importedRecords }, null, 2));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
