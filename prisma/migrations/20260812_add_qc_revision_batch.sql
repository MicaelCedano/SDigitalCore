-- Migración manual para Supabase: Módulo Lotes de Revisión (QC)
-- Fecha: 2026-08-12

-- 1. Crear enum qc_batch_status
DO $$ BEGIN
    CREATE TYPE "qc_batch_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Crear tabla qc_revision_batch
CREATE TABLE IF NOT EXISTS "qc_revision_batch" (
    "id" TEXT NOT NULL,
    "batch_number" VARCHAR(60) NOT NULL,
    "supplier_id" TEXT,
    "supplier_name" VARCHAR(160) NOT NULL,
    "branch" VARCHAR(100) NOT NULL,
    "received_by" VARCHAR(160) NOT NULL,
    "status" "qc_batch_status" NOT NULL DEFAULT 'PENDING_REVIEW',
    "total_devices" INTEGER NOT NULL DEFAULT 0,
    "reviewed_devices" INTEGER NOT NULL DEFAULT 0,
    "functional_count" INTEGER NOT NULL DEFAULT 0,
    "non_functional_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_revision_batch_pkey" PRIMARY KEY ("id")
);

-- 3. Índices y unicidad
CREATE UNIQUE INDEX IF NOT EXISTS "qc_revision_batch_batch_number_key" ON "qc_revision_batch"("batch_number");
CREATE INDEX IF NOT EXISTS "qc_revision_batch_status_received_at_idx" ON "qc_revision_batch"("status", "received_at");
CREATE INDEX IF NOT EXISTS "qc_revision_batch_supplier_name_received_at_idx" ON "qc_revision_batch"("supplier_name", "received_at");

-- 4. Añadir batch_id a device_unit
ALTER TABLE "device_unit" ADD COLUMN IF NOT EXISTS "batch_id" TEXT;

-- 5. Foreign key e índices en device_unit
ALTER TABLE "device_unit" DROP CONSTRAINT IF EXISTS "device_unit_batch_id_fkey";
ALTER TABLE "device_unit" ADD CONSTRAINT "device_unit_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "qc_revision_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "device_unit_batch_id_idx" ON "device_unit"("batch_id");
