-- Penalidades (port de SDigitalSystem): sanciones al wallet de QCs/técnicos.
-- Interna: ligada al equipo (device_id) y al último revisor que lo inspeccionó.
-- Externa: el admin señala al culpable directamente (IMEI/modelo libres).
-- El asiento del wallet (DEBIT) vive en wallet_ledger_entry; penalty.ledger_entry_id
-- lo enlaza para poder revertir (REVERSED) sin borrar (auditoría).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'penalty_type') THEN
    CREATE TYPE "penalty_type" AS ENUM ('INTERNAL', 'EXTERNAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'penalty_status') THEN
    CREATE TYPE "penalty_status" AS ENUM ('ACTIVE', 'REVERSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "penalty" (
  "id" TEXT NOT NULL,
  "type" "penalty_type" NOT NULL,
  "device_imei" VARCHAR(20),
  "device_model" VARCHAR(200),
  "device_id" TEXT,
  "technician_id" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "status" "penalty_status" NOT NULL DEFAULT 'ACTIVE',
  "admin_id" TEXT NOT NULL,
  "ledger_entry_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "penalty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "penalty_ledger_entry_id_key" ON "penalty"("ledger_entry_id");
CREATE INDEX IF NOT EXISTS "penalty_technician_id_created_at_idx" ON "penalty"("technician_id", "created_at");
CREATE INDEX IF NOT EXISTS "penalty_admin_id_created_at_idx" ON "penalty"("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "penalty_status_created_at_idx" ON "penalty"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "penalty" ADD CONSTRAINT "penalty_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "penalty" ADD CONSTRAINT "penalty_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "penalty" ADD CONSTRAINT "penalty_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "device_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "penalty" ADD CONSTRAINT "penalty_ledger_entry_id_fkey"
    FOREIGN KEY ("ledger_entry_id") REFERENCES "wallet_ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "penalty" ENABLE ROW LEVEL SECURITY;
