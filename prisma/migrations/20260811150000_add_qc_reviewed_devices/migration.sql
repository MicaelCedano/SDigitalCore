CREATE TYPE "DeviceOperationalStatus" AS ENUM ('PENDING_QC', 'IN_QC', 'AVAILABLE', 'QUARANTINED', 'ARCHIVED');
CREATE TYPE "QcInspectionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'SUPERSEDED');
CREATE TYPE "QcInspectionResult" AS ENUM ('FUNCTIONAL', 'NON_FUNCTIONAL');

CREATE TABLE "device_unit" (
    "id" TEXT NOT NULL,
    "imei" VARCHAR(20),
    "serial_number" VARCHAR(120),
    "brand" VARCHAR(100),
    "model" VARCHAR(150) NOT NULL,
    "storage_gb" INTEGER,
    "color" VARCHAR(80),
    "status" "DeviceOperationalStatus" NOT NULL DEFAULT 'PENDING_QC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_unit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "device_unit_identifier_check" CHECK ("imei" IS NOT NULL OR "serial_number" IS NOT NULL)
);

CREATE TABLE "qc_inspection" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewer_name_snapshot" VARCHAR(160) NOT NULL,
    "status" "QcInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "result" "QcInspectionResult",
    "grade" VARCHAR(16),
    "battery_health" INTEGER,
    "functionality_notes" TEXT,
    "physical_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "supersedes_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "qc_inspection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qc_inspection_battery_health_check" CHECK ("battery_health" IS NULL OR "battery_health" BETWEEN 0 AND 100),
    CONSTRAINT "qc_inspection_completed_fields_check" CHECK ("status" <> 'COMPLETED' OR ("result" IS NOT NULL AND "reviewed_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "device_unit_imei_key" ON "device_unit"("imei");
CREATE UNIQUE INDEX "device_unit_serial_number_key" ON "device_unit"("serial_number");
CREATE INDEX "device_unit_status_updated_at_idx" ON "device_unit"("status", "updated_at");
CREATE INDEX "device_unit_brand_model_idx" ON "device_unit"("brand", "model");
CREATE UNIQUE INDEX "qc_inspection_supersedes_id_key" ON "qc_inspection"("supersedes_id");
CREATE INDEX "qc_inspection_device_id_reviewed_at_idx" ON "qc_inspection"("device_id", "reviewed_at");
CREATE INDEX "qc_inspection_reviewer_id_reviewed_at_idx" ON "qc_inspection"("reviewer_id", "reviewed_at");
CREATE INDEX "qc_inspection_status_reviewed_at_idx" ON "qc_inspection"("status", "reviewed_at");
CREATE INDEX "qc_inspection_result_reviewed_at_idx" ON "qc_inspection"("result", "reviewed_at");

ALTER TABLE "qc_inspection" ADD CONSTRAINT "qc_inspection_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_inspection" ADD CONSTRAINT "qc_inspection_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_inspection" ADD CONSTRAINT "qc_inspection_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "qc_inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "device_unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qc_inspection" ENABLE ROW LEVEL SECURITY;

UPDATE "user"
SET "allowed_modules" = array_append("allowed_modules", 'qc')
WHERE "role_code" = 'QC' AND NOT ('qc' = ANY("allowed_modules"));
