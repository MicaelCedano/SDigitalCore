-- Evita dos casos abiertos para el mismo IMEI, incluso ante solicitudes concurrentes.
-- Los casos entregados, cerrados por nota de crédito o archivados no bloquean un nuevo ingreso.
CREATE UNIQUE INDEX IF NOT EXISTS "warranty_case_one_open_imei_key"
ON "warranty_case" ("imei")
WHERE "archived_at" IS NULL
  AND "status" NOT IN ('DELIVERED', 'CREDIT_NOTE');
