-- Migración manual para Supabase: Asignación de IMEIs a QC + Solicitudes de IMEIs
-- Fecha: 2026-08-12
-- Fórmula de SDigitalSystem: el QC solicita IMEIs, el admin los acepta (o los
-- asigna directo); los IMEIs quedan asignados al QC y él los revisa.

-- 1. Asignación por equipo (IMEI) en device_unit
ALTER TABLE "device_unit" ADD COLUMN IF NOT EXISTS "assigned_to_id" TEXT;

ALTER TABLE "device_unit" DROP CONSTRAINT IF EXISTS "device_unit_assigned_to_id_fkey";
ALTER TABLE "device_unit" ADD CONSTRAINT "device_unit_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "device_unit_assigned_to_id_idx"
  ON "device_unit"("assigned_to_id");

-- 2. Solicitudes de IMEIs del QC
CREATE TABLE IF NOT EXISTS "qc_imei_request" (
  "id" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL,
  "imeis" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "accepted_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qc_imei_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "qc_imei_request_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "qc_imei_request_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "qc_imei_request_requester_id_created_at_idx"
  ON "qc_imei_request"("requester_id", "created_at");

CREATE INDEX IF NOT EXISTS "qc_imei_request_status_created_at_idx"
  ON "qc_imei_request"("status", "created_at");
