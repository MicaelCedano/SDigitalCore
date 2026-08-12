-- 20260812_add_repair_traceability.sql
-- Trazabilidad legacy para repair_job / repair_job_item (migración de reparaciones de System)
-- Patrón idéntico a 20260812_add_unlock_traceability.sql

ALTER TABLE repair_job ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE repair_job ADD COLUMN IF NOT EXISTS source_record_id TEXT;

ALTER TABLE repair_job_item ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE repair_job_item ADD COLUMN IF NOT EXISTS source_record_id TEXT;

-- Índices únicos: filas con NULLs (jobs normales de la app) no colisionan en Postgres,
-- igual que el patrón 20260812_add_unlock_traceability.sql
DROP INDEX IF EXISTS repair_job_source_unique;
DROP INDEX IF EXISTS repair_job_item_source_unique;
CREATE UNIQUE INDEX repair_job_source_unique
  ON repair_job (source_system, source_record_id);
CREATE UNIQUE INDEX repair_job_item_source_unique
  ON repair_job_item (source_system, source_record_id);
