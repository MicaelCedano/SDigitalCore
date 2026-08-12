-- Trazabilidad legacy para el módulo Desbloqueos (migración desde SDigitalSystem).
-- Idempotente: solo agrega columnas e índices si faltan.

ALTER TABLE "unlock_request"
  ADD COLUMN IF NOT EXISTS "source_system" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "source_record_id" VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS "unlock_request_source_system_source_record_id_key"
  ON "unlock_request"("source_system", "source_record_id");

ALTER TABLE "unlock_record"
  ADD COLUMN IF NOT EXISTS "source_system" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "source_record_id" VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS "unlock_record_source_system_source_record_id_key"
  ON "unlock_record"("source_system", "source_record_id");
