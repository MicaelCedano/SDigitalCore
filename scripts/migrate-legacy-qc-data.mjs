import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const SOURCE_SYSTEM = "SDIGITALSYSTEM";
const BATCH_SIZE = 500;
const apply = process.argv.includes("--apply");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

function clean(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function normalizeResult(value) {
  const normalized = clean(value)?.toLocaleLowerCase("es");
  if (normalized === "funcional") return "FUNCTIONAL";
  if (normalized === "no funcional") return "NON_FUNCTIONAL";
  return "UNSPECIFIED";
}

function deviceStatus(sourceStatus, result) {
  if (sourceStatus.trim().toLocaleLowerCase("es") === "entregado") return "ARCHIVED";
  if (result === "UNSPECIFIED") return "QUARANTINED";
  return result === "FUNCTIONAL" ? "AVAILABLE" : "QUARANTINED";
}

async function readSource(source) {
  const suppliers = (await source.query(`
    SELECT id::text AS "sourceRecordId", name, NULLIF(BTRIM(contact_info), '') AS "contactInfo"
    FROM supplier
    ORDER BY id
  `)).rows;

  const inspections = (await source.query(`
    WITH latest_review AS (
      SELECT DISTINCT ON (h.equipo_id)
        h.equipo_id,
        h.user_id,
        h.fecha,
        h.id
      FROM equipo_historial h
      WHERE h.estado = 'Revisado'
      ORDER BY h.equipo_id, h.fecha DESC NULLS LAST, h.id DESC
    ),
    latest_identified_reviewer AS (
      SELECT DISTINCT ON (h.equipo_id)
        h.equipo_id,
        h.user_id
      FROM equipo_historial h
      WHERE h.estado = 'Revisado' AND h.user_id IS NOT NULL
      ORDER BY h.equipo_id, h.fecha DESC NULLS LAST, h.id DESC
    )
    SELECT
      e.id::text AS "sourceRecordId",
      BTRIM(e.imei) AS imei,
      NULLIF(BTRIM(e.marca), '') AS brand,
      BTRIM(e.modelo) AS model,
      e.storage_gb AS "storageGb",
      NULLIF(BTRIM(e.color), '') AS color,
      e.estado AS "sourceStatus",
      e.fecha_ingreso AS "createdAt",
      NULLIF(BTRIM(e.grado), '') AS grade,
      NULLIF(BTRIM(e.observacion), '') AS notes,
      e.funcionalidad AS functionality,
      latest_review.fecha AS "reviewedAt",
      COALESCE(latest_review.user_id, latest_identified_reviewer.user_id)::text AS "reviewerSourceUserId",
      COALESCE(NULLIF(BTRIM(u.name), ''), NULLIF(BTRIM(u.username), ''), 'Revisor histórico no registrado') AS "reviewerName"
    FROM latest_review
    JOIN equipo e ON e.id = latest_review.equipo_id
    LEFT JOIN latest_identified_reviewer ON latest_identified_reviewer.equipo_id = latest_review.equipo_id
    LEFT JOIN users u ON u.id = COALESCE(latest_review.user_id, latest_identified_reviewer.user_id)
    WHERE e.modelo IS NOT NULL
      AND BTRIM(e.modelo) <> ''
      AND latest_review.fecha IS NOT NULL
    ORDER BY e.id
  `)).rows;

  const counts = (await source.query(`
    WITH latest_review AS (
      SELECT DISTINCT ON (h.equipo_id) h.equipo_id
      FROM equipo_historial h
      WHERE h.estado = 'Revisado'
      ORDER BY h.equipo_id, h.fecha DESC NULLS LAST, h.id DESC
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE LOWER(BTRIM(COALESCE(e.funcionalidad, ''))) NOT IN ('funcional', 'no funcional')
      )::int AS "sourceUnclassified"
    FROM latest_review
    JOIN equipo e ON e.id = latest_review.equipo_id
  `)).rows[0];

  return { suppliers, inspections, counts };
}

async function readReviewerLinks(target) {
  const rows = (await target.query(`
    SELECT source_user_id AS "sourceUserId", core_user_id AS "coreUserId"
    FROM legacy_user_identity
    WHERE source_system = $1 AND core_user_id IS NOT NULL
  `, [SOURCE_SYSTEM])).rows;
  return new Map(rows.map((row) => [row.sourceUserId, row.coreUserId]));
}

function buildSnapshot(sourceData, reviewerLinks) {
  const suppliers = sourceData.suppliers.map((supplier) => ({
    id: `legacy-sds-supplier-${supplier.sourceRecordId}`,
    sourceSystem: SOURCE_SYSTEM,
    sourceRecordId: supplier.sourceRecordId,
    name: supplier.name.trim(),
    notes: clean(supplier.contactInfo),
  }));

  const inspections = sourceData.inspections.map((inspection) => {
    const result = normalizeResult(inspection.functionality);
    const sourceRecordId = inspection.sourceRecordId;
    return {
      device: {
        id: `legacy-sds-device-${sourceRecordId}`,
        imei: inspection.imei,
        brand: clean(inspection.brand) || "Apple",
        model: inspection.model.trim(),
        storageGb: inspection.storageGb,
        color: clean(inspection.color),
        status: deviceStatus(inspection.sourceStatus, result),
        batchId: "legacy-sds-batch-initial",
        sourceSystem: SOURCE_SYSTEM,
        sourceRecordId,
        createdAt: inspection.createdAt,
        updatedAt: inspection.reviewedAt,
      },
      inspection: {
        id: `legacy-sds-inspection-${sourceRecordId}`,
        deviceId: `legacy-sds-device-${sourceRecordId}`,
        reviewerId: reviewerLinks.get(inspection.reviewerSourceUserId) ?? null,
        reviewerName: inspection.reviewerName.slice(0, 160),
        result,
        grade: clean(inspection.grade),
        notes: clean(inspection.notes),
        reviewedAt: inspection.reviewedAt,
        sourceSystem: SOURCE_SYSTEM,
        sourceRecordId,
      },
    };
  });

  return { suppliers, inspections };
}

async function assertTargetSchema(target) {
  const row = (await target.query(`
    SELECT
      to_regclass('public.qc_supplier') IS NOT NULL AS suppliers,
      to_regclass('public.qc_revision_batch') IS NOT NULL AS batches,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'device_unit' AND column_name = 'source_record_id'
      ) AS devices,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'qc_inspection' AND column_name = 'source_record_id'
      ) AS inspections
  `)).rows[0];
  if (!row.suppliers || !row.batches || !row.devices || !row.inspections) {
    throw new Error("El esquema de proveedores, lotes o trazabilidad QC todavía no está aplicado en Core.");
  }
}

async function importSuppliers(target, suppliers) {
  const result = await target.query(`
    WITH payload AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS item(
        id text,
        "sourceSystem" text,
        "sourceRecordId" text,
        name text,
        notes text
      )
    )
    INSERT INTO qc_supplier (
      id, name, notes, status, source_system, source_record_id, created_at, updated_at
    )
    SELECT id, name, notes, 'ACTIVE'::qc_supplier_status, "sourceSystem", "sourceRecordId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM payload
    ON CONFLICT (source_system, source_record_id) DO UPDATE SET
      name = EXCLUDED.name,
      notes = COALESCE(EXCLUDED.notes, qc_supplier.notes),
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [JSON.stringify(suppliers)]);
  return result.rowCount;
}

async function importLegacyBatch(target, summary) {
  await target.query(`
    INSERT INTO qc_revision_batch (
      id, batch_number, supplier_name, branch, received_by, status,
      total_devices, reviewed_devices, functional_count, non_functional_count,
      notes, created_at, updated_at
    ) VALUES (
      'legacy-sds-batch-initial',
      'LOT-LEGACY-SDIGITALSYSTEM',
      'Importación Histórica SDigitalSystem',
      'Principal',
      'Migración de Sistema Legacy',
      'COMPLETED'::qc_batch_status,
      $1, $2, $3, $4,
      'Lote generado automáticamente durante la migración de equipos y compras desde SDigitalSystem',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (batch_number) DO UPDATE SET
      total_devices = EXCLUDED.total_devices,
      reviewed_devices = EXCLUDED.reviewed_devices,
      functional_count = EXCLUDED.functional_count,
      non_functional_count = EXCLUDED.non_functional_count,
      updated_at = CURRENT_TIMESTAMP
  `, [
    summary.importableInspections,
    summary.importableInspections,
    summary.functional,
    summary.nonFunctional,
  ]);
}

async function importInspectionBatch(target, records) {
  const devices = records.map((record) => record.device);
  const inspections = records.map((record) => record.inspection);

  await target.query("BEGIN");
  try {
    await target.query("SET LOCAL statement_timeout = '60s'");
    await target.query(`
      WITH payload AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS item(
          id text,
          imei text,
          brand text,
          model text,
          "storageGb" integer,
          color text,
          status text,
          "batchId" text,
          "sourceSystem" text,
          "sourceRecordId" text,
          "createdAt" timestamp,
          "updatedAt" timestamp
        )
      )
      INSERT INTO device_unit (
        id, imei, brand, model, storage_gb, color, status, batch_id,
        source_system, source_record_id, created_at, updated_at
      )
      SELECT
        id, imei, brand, model, "storageGb", color, status::"DeviceOperationalStatus", "batchId",
        "sourceSystem", "sourceRecordId", "createdAt", "updatedAt"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        imei = EXCLUDED.imei,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        storage_gb = EXCLUDED.storage_gb,
        color = EXCLUDED.color,
        status = EXCLUDED.status,
        batch_id = EXCLUDED.batch_id,
        updated_at = EXCLUDED.updated_at
    `, [JSON.stringify(devices)]);

    await target.query(`
      WITH payload AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS item(
          id text,
          "deviceId" text,
          "reviewerId" text,
          "reviewerName" text,
          result text,
          grade text,
          notes text,
          "reviewedAt" timestamp,
          "sourceSystem" text,
          "sourceRecordId" text
        )
      )
      INSERT INTO qc_inspection (
        id, device_id, reviewer_id, reviewer_name_snapshot, status, result,
        grade, functionality_notes, reviewed_at, source_system, source_record_id,
        created_at, updated_at
      )
      SELECT
        id, "deviceId", "reviewerId", "reviewerName", 'COMPLETED'::"QcInspectionStatus",
        result::"QcInspectionResult", grade, notes, "reviewedAt", "sourceSystem", "sourceRecordId",
        "reviewedAt", "reviewedAt"
      FROM payload
      ON CONFLICT (source_system, source_record_id) DO UPDATE SET
        reviewer_id = EXCLUDED.reviewer_id,
        reviewer_name_snapshot = EXCLUDED.reviewer_name_snapshot,
        result = EXCLUDED.result,
        grade = EXCLUDED.grade,
        functionality_notes = EXCLUDED.functionality_notes,
        reviewed_at = EXCLUDED.reviewed_at,
        updated_at = EXCLUDED.updated_at
    `, [JSON.stringify(inspections)]);
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  }
}

async function writeAudit(target, summary) {
  await target.query(`
    INSERT INTO audit_log (
      id, action, module, entity_type, entity_id, after_data, user_agent, created_at
    ) VALUES ($1, 'legacy_qc.import', 'qc', 'legacy_qc_import', $2, $3::jsonb, 'migration:legacy-qc', CURRENT_TIMESTAMP)
  `, [crypto.randomUUID(), SOURCE_SYSTEM, JSON.stringify(summary)]);
}

async function main() {
  const source = new Client({
    connectionString: requiredEnv("SOURCE_DATABASE_URL"),
    application_name: "sdigitalcore-legacy-qc-reader",
    connectionTimeoutMillis: 15_000,
  });
  const target = new Client({
    connectionString: requiredEnv("DATABASE_URL"),
    application_name: "sdigitalcore-legacy-qc-importer",
    connectionTimeoutMillis: 15_000,
  });

  await Promise.all([source.connect(), target.connect()]);
  try {
    const sourceData = await readSource(source);
    const reviewerLinks = await readReviewerLinks(target);
    const snapshot = buildSnapshot(sourceData, reviewerLinks);
    const summary = {
      mode: apply ? "APPLY" : "DRY_RUN",
      sourceSuppliers: snapshot.suppliers.length,
      sourceReviewedDevices: sourceData.counts.total,
      importableInspections: snapshot.inspections.length,
      sourceUnclassified: sourceData.counts.sourceUnclassified,
      functional: snapshot.inspections.filter((item) => item.inspection.result === "FUNCTIONAL").length,
      nonFunctional: snapshot.inspections.filter((item) => item.inspection.result === "NON_FUNCTIONAL").length,
      unspecified: snapshot.inspections.filter((item) => item.inspection.result === "UNSPECIFIED").length,
      linkedReviewerInspections: snapshot.inspections.filter((item) => item.inspection.reviewerId !== null).length,
      snapshotOnlyReviewerInspections: snapshot.inspections.filter((item) => item.inspection.reviewerId === null).length,
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    await assertTargetSchema(target);
    const importedSuppliers = await importSuppliers(target, snapshot.suppliers);
    await importLegacyBatch(target, summary);
    let importedInspections = 0;
    for (const batch of chunks(snapshot.inspections, BATCH_SIZE)) {
      await importInspectionBatch(target, batch);
      importedInspections += batch.length;
      console.log(JSON.stringify({ progress: importedInspections, total: snapshot.inspections.length }));
    }
    await writeAudit(target, { ...summary, importedSuppliers, importedInspections });
    console.log(JSON.stringify({ success: true, importedSuppliers, importedInspections }, null, 2));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
