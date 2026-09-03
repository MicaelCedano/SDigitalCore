ALTER TABLE "qc_revision_batch"
  ADD COLUMN "is_work_lot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "parent_batch_id" TEXT,
  ADD COLUMN "request_id" TEXT;

ALTER TABLE "device_unit"
  ADD COLUMN "origin_batch_id" TEXT;

CREATE UNIQUE INDEX "qc_revision_batch_request_id_key"
  ON "qc_revision_batch"("request_id");
CREATE INDEX "qc_revision_batch_parent_batch_id_idx"
  ON "qc_revision_batch"("parent_batch_id");
CREATE INDEX "qc_revision_batch_is_work_lot_status_created_at_idx"
  ON "qc_revision_batch"("is_work_lot", "status", "created_at");
CREATE INDEX "device_unit_origin_batch_id_idx"
  ON "device_unit"("origin_batch_id");

ALTER TABLE "qc_revision_batch"
  ADD CONSTRAINT "qc_revision_batch_parent_batch_id_fkey"
  FOREIGN KEY ("parent_batch_id") REFERENCES "qc_revision_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qc_revision_batch"
  ADD CONSTRAINT "qc_revision_batch_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "qc_imei_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "device_unit"
  ADD CONSTRAINT "device_unit_origin_batch_id_fkey"
  FOREIGN KEY ("origin_batch_id") REFERENCES "qc_revision_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "device_unit"
SET "origin_batch_id" = "batch_id"
WHERE "origin_batch_id" IS NULL AND "batch_id" IS NOT NULL;

DO $$
DECLARE
  req RECORD;
  source RECORD;
  new_batch_id TEXT;
  source_count INTEGER;
  suffix TEXT;
  assigned_count INTEGER;
  reviewed_count INTEGER;
  f_count INTEGER;
  nf_count INTEGER;
BEGIN
  FOR req IN
    SELECT r.*
    FROM "qc_imei_request" r
    WHERE r.status = 'ACCEPTED'
      AND EXISTS (
        SELECT 1
        FROM "device_unit" d
        WHERE d.assigned_to_id = r.requester_id
          AND d.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(r.imeis) AS value)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "qc_imei_request" newer
        WHERE newer.requester_id = r.requester_id
          AND newer.status = 'ACCEPTED'
          AND newer.created_at > r.created_at
          AND EXISTS (
            SELECT 1
            FROM "device_unit" newer_device
            WHERE newer_device.assigned_to_id = r.requester_id
              AND newer_device.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(newer.imeis) AS value)
              AND newer_device.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(r.imeis) AS value)
          )
      )
  LOOP
    SELECT COUNT(DISTINCT d.batch_id)::INTEGER INTO source_count
    FROM "device_unit" d
    WHERE d.assigned_to_id = req.requester_id
      AND d.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(req.imeis) AS value)
      AND d.batch_id IS NOT NULL;

    FOR source IN
      SELECT b.id, b.batch_number, b.supplier_id, b.supplier_name, b.branch, b.received_by,
             COUNT(d.id)::INTEGER AS device_count
      FROM "device_unit" d
      JOIN "qc_revision_batch" b ON b.id = d.batch_id AND b.is_work_lot = false
      WHERE d.assigned_to_id = req.requester_id
        AND d.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(req.imeis) AS value)
      GROUP BY b.id, b.batch_number, b.supplier_id, b.supplier_name, b.branch, b.received_by
    LOOP
      suffix := RIGHT(req.id, 8) || '-' || RIGHT(source.id, 4);
      INSERT INTO "qc_revision_batch" (
        id, batch_number, supplier_id, supplier_name, branch, received_by,
        assigned_to_id, status, total_devices, reviewed_devices,
        functional_count, non_functional_count, notes, received_at,
        created_at, updated_at, is_work_lot, parent_batch_id, request_id
      ) VALUES (
        'work-' || req.id || '-' || source.id,
        LEFT(source.batch_number || '-R-' || suffix, 60),
        source.supplier_id, source.supplier_name, source.branch, source.received_by,
        req.requester_id, 'IN_REVIEW', source.device_count, 0,
        0, 0, 'Lote de trabajo migrado desde la solicitud ' || req.id ||
          '. Lote de origen: ' || source.batch_number,
        req.created_at, req.created_at, NOW(), true, source.id,
        CASE WHEN source_count = 1 THEN req.id ELSE NULL END
      ) RETURNING id INTO new_batch_id;

      UPDATE "device_unit" d
      SET origin_batch_id = COALESCE(d.origin_batch_id, d.batch_id),
          batch_id = new_batch_id
      WHERE d.assigned_to_id = req.requester_id
        AND d.batch_id = source.id
        AND d.imei IN (SELECT value->>'imei' FROM jsonb_array_elements(req.imeis) AS value);

      SELECT COUNT(*)::INTEGER INTO reviewed_count
      FROM "device_unit" d
      WHERE d.batch_id = new_batch_id
        AND EXISTS (
          SELECT 1 FROM "qc_inspection" i
          WHERE i.device_id = d.id AND i.status = 'COMPLETED' AND i.created_at >= req.created_at
        );
      SELECT COUNT(*)::INTEGER INTO f_count
      FROM "device_unit" d
      JOIN LATERAL (
        SELECT i.result FROM "qc_inspection" i
        WHERE i.device_id = d.id AND i.status = 'COMPLETED' AND i.created_at >= req.created_at
        ORDER BY i.created_at DESC LIMIT 1
      ) i ON true
      WHERE d.batch_id = new_batch_id AND i.result = 'FUNCTIONAL';
      SELECT COUNT(*)::INTEGER INTO nf_count
      FROM "device_unit" d
      JOIN LATERAL (
        SELECT i.result FROM "qc_inspection" i
        WHERE i.device_id = d.id AND i.status = 'COMPLETED' AND i.created_at >= req.created_at
        ORDER BY i.created_at DESC LIMIT 1
      ) i ON true
      WHERE d.batch_id = new_batch_id AND i.result = 'NON_FUNCTIONAL';

      UPDATE "qc_revision_batch"
      SET reviewed_devices = reviewed_count,
          functional_count = f_count,
          non_functional_count = nf_count
      WHERE id = new_batch_id;
    END LOOP;
  END LOOP;
END $$;
