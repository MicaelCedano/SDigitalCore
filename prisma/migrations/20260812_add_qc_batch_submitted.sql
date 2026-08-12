-- Migración manual para Supabase: estado SUBMITTED en qc_revision_batch
-- Fecha: 2026-08-12
-- Flujo: PENDING_REVIEW → IN_REVIEW → (QC revisa todo) → SUBMITTED → (admin acepta) → COMPLETED + pago

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'qc_batch_status'::regtype
          AND enumlabel = 'SUBMITTED'
    ) THEN
        ALTER TYPE "qc_batch_status" ADD VALUE 'SUBMITTED';
    END IF;
END $$;
