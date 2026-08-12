-- Módulo Reparaciones: trabajos de reparación y pago a técnicos.
-- Fórmula SDigitalSystem (garantias: garantia_lote_ingreso + garantia + tecnico_garantia_pago + wallet).

-- Estado de un trabajo de reparación (lote reportado por el técnico)
DO $$ BEGIN
    CREATE TYPE "repair_job_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Lote de trabajo reportado por un técnico de reparaciones.
CREATE TABLE IF NOT EXISTS "repair_job" (
  "id" TEXT NOT NULL,
  "job_code" TEXT NOT NULL,
  "technician_id" TEXT NOT NULL,
  "status" "repair_job_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "observaciones" TEXT,
  "total_equipos" INTEGER NOT NULL DEFAULT 0,
  "monto_por_equipo" DECIMAL(10,2) NOT NULL DEFAULT 50,
  "monto_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "repair_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repair_job_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "repair_job_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_job_job_code_key" ON "repair_job"("job_code");
CREATE INDEX IF NOT EXISTS "repair_job_technician_id_status_idx" ON "repair_job"("technician_id", "status");
CREATE INDEX IF NOT EXISTS "repair_job_status_created_at_idx" ON "repair_job"("status", "created_at");

-- Ítem del trabajo: un equipo reparado (IMEI). Puede venir de un caso de garantía
-- (warranty_case_id) o ser reporte directo del técnico (IMEI suelto, fórmula System).
CREATE TABLE IF NOT EXISTS "repair_job_item" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "imei" TEXT NOT NULL,
  "marca" TEXT,
  "modelo" TEXT,
  "problema" TEXT NOT NULL,
  "cliente" TEXT NOT NULL,
  "warranty_case_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "repair_job_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repair_job_item_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "repair_job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "repair_job_item_warranty_case_id_fkey"
    FOREIGN KEY ("warranty_case_id") REFERENCES "warranty_case"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "repair_job_item_imei_idx" ON "repair_job_item"("imei");
CREATE INDEX IF NOT EXISTS "repair_job_item_job_id_idx" ON "repair_job_item"("job_id");
CREATE INDEX IF NOT EXISTS "repair_job_item_warranty_case_id_idx" ON "repair_job_item"("warranty_case_id");

-- Tarifa por técnico (fórmula System: tecnico_garantia_pago, default RD$50 por equipo).
CREATE TABLE IF NOT EXISTS "technician_repair_rate" (
  "id" TEXT NOT NULL,
  "technician_id" TEXT NOT NULL,
  "monto_por_reparacion" DECIMAL(10,2) NOT NULL DEFAULT 50,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "admin_id" TEXT,
  "fecha_configuracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_repair_rate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technician_repair_rate_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "technician_repair_rate_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "technician_repair_rate_technician_id_key" ON "technician_repair_rate"("technician_id");
