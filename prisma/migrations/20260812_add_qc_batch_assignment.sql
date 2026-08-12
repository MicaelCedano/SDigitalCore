-- Migración manual para Supabase: Asignación de Lotes de Revisión a QC
-- Fecha: 2026-08-12
-- El admin ingresa las compras/lotes y los asigna; los de QC solo revisan los suyos.

ALTER TABLE "qc_revision_batch" ADD COLUMN IF NOT EXISTS "assigned_to_id" TEXT;

ALTER TABLE "qc_revision_batch" DROP CONSTRAINT IF EXISTS "qc_revision_batch_assigned_to_id_fkey";
ALTER TABLE "qc_revision_batch" ADD CONSTRAINT "qc_revision_batch_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "qc_revision_batch_assigned_to_id_idx"
  ON "qc_revision_batch"("assigned_to_id");
