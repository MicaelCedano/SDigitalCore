-- Módulo Desbloqueos: solicitudes de desbloqueo y pago a técnicos.
-- Fórmula SDigitalSystem (solicitud_desbloqueo + unlock_record + RD$25 fijo).

DO $$ BEGIN
    CREATE TYPE "unlock_request_status" AS ENUM ('PENDING_ADMIN', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Solicitud de desbloqueo creada por el técnico (IMEIs en JSON, módulo independiente
-- del inventario, igual que System).
CREATE TABLE IF NOT EXISTS "unlock_request" (
  "id" TEXT NOT NULL,
  "request_code" TEXT NOT NULL,
  "technician_id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "imeis" JSONB NOT NULL,
  "status" "unlock_request_status" NOT NULL DEFAULT 'PENDING_ADMIN',
  "observacion" TEXT,
  "total_equipos" INTEGER NOT NULL DEFAULT 0,
  "monto_por_equipo" DECIMAL(10,2) NOT NULL DEFAULT 25,
  "monto_total_pagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "admin_id" TEXT,
  "admin_observation" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unlock_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unlock_request_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "unlock_request_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "unlock_request_request_code_key" ON "unlock_request"("request_code");
CREATE INDEX IF NOT EXISTS "unlock_request_technician_id_status_idx" ON "unlock_request"("technician_id", "status");
CREATE INDEX IF NOT EXISTS "unlock_request_status_created_at_idx" ON "unlock_request"("status", "created_at");

-- Registro de auditoría del desbloqueo: IMEI único = anti-doble-pago.
CREATE TABLE IF NOT EXISTS "unlock_record" (
  "id" TEXT NOT NULL,
  "imei" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "technician_id" TEXT NOT NULL,
  "admin_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unlock_record_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unlock_record_imei_key" UNIQUE ("imei"),
  CONSTRAINT "unlock_record_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "unlock_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "unlock_record_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "unlock_record_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "unlock_record_technician_id_idx" ON "unlock_record"("technician_id");
CREATE INDEX IF NOT EXISTS "unlock_record_created_at_idx" ON "unlock_record"("created_at");
