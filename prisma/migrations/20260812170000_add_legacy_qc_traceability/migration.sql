ALTER TABLE "device_unit"
ADD COLUMN "source_system" VARCHAR(50),
ADD COLUMN "source_record_id" VARCHAR(80),
ADD CONSTRAINT "device_unit_source_pair_check"
CHECK (("source_system" IS NULL) = ("source_record_id" IS NULL));

ALTER TABLE "qc_inspection"
ALTER COLUMN "reviewer_id" DROP NOT NULL,
ADD COLUMN "source_system" VARCHAR(50),
ADD COLUMN "source_record_id" VARCHAR(80),
ADD CONSTRAINT "qc_inspection_source_pair_check"
CHECK (("source_system" IS NULL) = ("source_record_id" IS NULL));

ALTER TABLE "qc_supplier"
ADD COLUMN "source_system" VARCHAR(50),
ADD COLUMN "source_record_id" VARCHAR(80),
ADD CONSTRAINT "qc_supplier_source_pair_check"
CHECK (("source_system" IS NULL) = ("source_record_id" IS NULL));

CREATE UNIQUE INDEX "device_unit_source_system_source_record_id_key"
ON "device_unit"("source_system", "source_record_id");

CREATE UNIQUE INDEX "qc_inspection_source_system_source_record_id_key"
ON "qc_inspection"("source_system", "source_record_id");

CREATE UNIQUE INDEX "qc_supplier_source_system_source_record_id_key"
ON "qc_supplier"("source_system", "source_record_id");
