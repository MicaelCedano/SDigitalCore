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
  const status = (sourceStatus || "").trim().toLocaleLowerCase("es");
  if (status === "entregado" || status === "vendido") return "ARCHIVED";
  if (status === "ingresado" || status === "pendiente") return "PENDING_QC";
  if (result === "UNSPECIFIED") return "QUARANTINED";
  return result === "FUNCTIONAL" ? "AVAILABLE" : "QUARANTINED";
}

async function readSource(source) {
  const suppliers = (await source.query(`
    SELECT id::text AS "sourceRecordId", name, NULLIF(BTRIM(contact_info), '') AS "contactInfo"
    FROM supplier
    ORDER BY id
  `)).rows;

  const purchases = (await source.query(`
    WITH latest_qc_review AS (
      SELECT DISTINCT ON (h.equipo_id)
        h.equipo_id,
        h.user_id,
        h.fecha,
        h.id
      FROM equipo_historial h
      LEFT JOIN users reviewer ON reviewer.id = h.user_id
      WHERE h.estado = 'Revisado'
        AND h.user_id IS NOT NULL
        AND LOWER(COALESCE(NULLIF(BTRIM(reviewer.username), ''), NULLIF(BTRIM(reviewer.name), ''), ''))
          NOT IN ('admin', 'administrador')
      ORDER BY h.equipo_id, h.fecha DESC NULLS LAST, h.id DESC
    )
    SELECT
      e.id::text AS "sourceRecordId",
      BTRIM(e.imei) AS imei,
      NULLIF(BTRIM(e.marca), '') AS brand,
      BTRIM(e.modelo) AS model,
      e.storage_gb AS "storageGb",
      NULLIF(BTRIM(e.color), '') AS color,
      COALESCE(e.estado, 'Ingresado') AS "sourceStatus",
      e.fecha_ingreso AS "createdAt",
      NULLIF(BTRIM(e.grado), '') AS grade,
      NULLIF(BTRIM(e.observacion), '') AS notes,
      e.funcionalidad AS functionality,
      e.purchase_id::text AS "purchaseId",
      p.purchase_date AS "purchaseDate",
      s.id::text AS "supplierSourceId",
      NULLIF(BTRIM(s.name), '') AS "supplierName",
      latest_qc_review.fecha AS "reviewedAt",
      latest_qc_review.user_id::text AS "reviewerSourceUserId",
      COALESCE(NULLIF(BTRIM(u.name), ''), NULLIF(BTRIM(u.username), ''), 'Revisor histórico no registrado') AS "reviewerName"
    FROM equipo e
    LEFT JOIN latest_qc_review ON e.id = latest_qc_review.equipo_id
    LEFT JOIN purchase p ON p.id = e.purchase_id
    LEFT JOIN supplier s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = latest_qc_review.user_id
    WHERE e.modelo IS NOT NULL
      AND BTRIM(e.modelo) <> ''
    ORDER BY e.id
  `)).rows;

  const counts = (await source.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE LOWER(BTRIM(COALESCE(funcionalidad, ''))) NOT IN ('funcional', 'no funcional')
      )::int AS "sourceUnclassified"
    FROM equipo
    WHERE modelo IS NOT NULL AND BTRIM(modelo) <> ''
  `)).rows[0];

  return { suppliers, purchases, counts };
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

  const batches = new Map();
  const records = sourceData.purchases.map((item) => {
    const result = normalizeResult(item.functionality);
    const sourceRecordId = item.sourceRecordId;
    const hasReview = Boolean(item.reviewedAt);
    const batchId = `legacy-sds-batch-p${item.purchaseId ?? "unknown"}`;
    if (!batches.has(batchId)) {
      batches.set(batchId, {
        id: batchId,
        batchNumber: `LOT-LEGACY-SDS-C${item.purchaseId ?? "unknown"}`,
        supplierId: item.supplierSourceId ? `legacy-sds-supplier-${item.supplierSourceId}` : null,
        supplierName: clean(item.supplierName) || "Importación Compras SDigitalSystem",
        receivedAt: item.purchaseDate || null,
      });
    }

    return {
      device: {
        id: `legacy-sds-device-${sourceRecordId}`,
        imei: item.imei,
        // No inventar una marca cuando el registro legacy no la tenía.
        brand: clean(item.brand),
        model: item.model.trim(),
        storageGb: item.storageGb,
        color: clean(item.color),
        status: deviceStatus(item.sourceStatus, result),
        batchId,
        sourceSystem: SOURCE_SYSTEM,
        sourceRecordId,
        createdAt: item.createdAt || new Date(),
        updatedAt: item.reviewedAt || item.createdAt || new Date(),
      },
      inspection: hasReview
        ? {
            id: `legacy-sds-inspection-${sourceRecordId}`,
            deviceId: `legacy-sds-device-${sourceRecordId}`,
            reviewerId: reviewerLinks.get(item.reviewerSourceUserId) ?? null,
            reviewerName: item.reviewerName.slice(0, 160),
            result,
            grade: clean(item.grade),
            notes: clean(item.notes),
            reviewedAt: item.reviewedAt,
            sourceSystem: SOURCE_SYSTEM,
            sourceRecordId,
          }
        : null,
    };
  });

  return { suppliers, records, batches: [...batches.values()] };
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

async function importBatches(target, batches, records) {
  const counts = new Map(
    batches.map((b) => [b.id, { total: 0, reviewed: 0, functional: 0, nonFunctional: 0, lastReviewedAt: null }])
  );
  for (const record of records) {
    const entry = counts.get(record.device.batchId);
    if (!entry) continue;
    entry.total += 1;
    if (record.inspection) {
      entry.reviewed += 1;
      if (record.inspection.result === "FUNCTIONAL") entry.functional += 1;
      else if (record.inspection.result === "NON_FUNCTIONAL") entry.nonFunctional += 1;
      if (!entry.lastReviewedAt || record.inspection.reviewedAt > entry.lastReviewedAt) {
        entry.lastReviewedAt = record.inspection.reviewedAt;
      }
    }
  }

  const payload = batches.map((b) => {
    const c = counts.get(b.id);
    return {
      id: b.id,
      batchNumber: b.batchNumber,
      supplierId: b.supplierId,
      supplierName: b.supplierName,
      receivedAt: b.receivedAt,
      completedAt: c?.lastReviewedAt ?? null,
      total: c?.total ?? 0,
      reviewed: c?.reviewed ?? 0,
      functional: c?.functional ?? 0,
      nonFunctional: c?.nonFunctional ?? 0,
    };
  });

  const result = await target.query(`
    WITH payload AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS item(
        id text,
        "batchNumber" text,
        "supplierId" text,
        "supplierName" text,
        "receivedAt" timestamp,
        "completedAt" timestamp,
        total int,
        reviewed int,
        functional int,
        "nonFunctional" int
      )
    )
    INSERT INTO qc_revision_batch (
      id, batch_number, supplier_id, supplier_name, branch, received_by, status,
      total_devices, reviewed_devices, functional_count, non_functional_count,
      notes, received_at, completed_at, created_at, updated_at
    )
    SELECT
      id, "batchNumber", "supplierId", "supplierName", 'Principal', 'Migración de Sistema Legacy',
      'COMPLETED'::qc_batch_status,
      total, reviewed, functional, "nonFunctional",
      'Lote generado automáticamente durante la migración de compras y equipos desde SDigitalSystem',
      COALESCE("receivedAt", CURRENT_TIMESTAMP), "completedAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM payload
    ON CONFLICT (batch_number) DO UPDATE SET
      supplier_id = EXCLUDED.supplier_id,
      supplier_name = EXCLUDED.supplier_name,
      total_devices = EXCLUDED.total_devices,
      reviewed_devices = EXCLUDED.reviewed_devices,
      functional_count = EXCLUDED.functional_count,
      non_functional_count = EXCLUDED.non_functional_count,
      received_at = EXCLUDED.received_at,
      completed_at = EXCLUDED.completed_at,
      updated_at = CURRENT_TIMESTAMP
  `, [JSON.stringify(payload)]);
  return result.rowCount;
}

async function removeLegacyInitialBatch(target) {
  const result = await target.query(`
    DELETE FROM qc_revision_batch
    WHERE id = 'legacy-sds-batch-initial' OR batch_number = 'LOT-LEGACY-SDIGITALSYSTEM'
  `);
  return result.rowCount;
}

async function importInspectionBatch(target, records) {
  const devices = records.map((r) => r.device);
  const inspections = records.filter((r) => r.inspection !== null).map((r) => r.inspection);

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

    if (inspections.length > 0) {
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
    }
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
    const reviewedRecords = snapshot.records.filter((item) => item.inspection !== null);

    const summary = {
      mode: apply ? "APPLY" : "DRY_RUN",
      sourceSuppliers: snapshot.suppliers.length,
      sourceBatches: snapshot.batches.length,
      totalPurchases: snapshot.records.length,
      reviewedDevices: reviewedRecords.length,
      unreviewedDevices: snapshot.records.length - reviewedRecords.length,
      sourceUnclassified: sourceData.counts.sourceUnclassified,
      functional: reviewedRecords.filter((item) => item.inspection.result === "FUNCTIONAL").length,
      nonFunctional: reviewedRecords.filter((item) => item.inspection.result === "NON_FUNCTIONAL").length,
      unspecified: reviewedRecords.filter((item) => item.inspection.result === "UNSPECIFIED").length,
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    await assertTargetSchema(target);
    const importedSuppliers = await importSuppliers(target, snapshot.suppliers);
    const importedBatches = await importBatches(target, snapshot.batches, snapshot.records);
    let importedPurchases = 0;
    for (const batch of chunks(snapshot.records, BATCH_SIZE)) {
      await importInspectionBatch(target, batch);
      importedPurchases += batch.length;
      console.log(JSON.stringify({ progress: importedPurchases, total: snapshot.records.length }));
    }
    const removedLegacyBatch = await removeLegacyInitialBatch(target);
    await writeAudit(target, { ...summary, importedSuppliers, importedBatches, removedLegacyBatch, importedPurchases });
    console.log(JSON.stringify({ success: true, importedSuppliers, importedBatches, removedLegacyBatch, importedPurchases }, null, 2));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
