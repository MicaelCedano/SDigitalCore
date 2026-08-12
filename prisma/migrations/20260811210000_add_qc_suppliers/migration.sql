CREATE TYPE "qc_supplier_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "qc_supplier" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(160),
    "phone" VARCHAR(40),
    "email" VARCHAR(200),
    "notes" TEXT,
    "status" "qc_supplier_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "qc_supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "qc_supplier_name_key" ON "qc_supplier"("name");
CREATE INDEX "qc_supplier_status_name_idx" ON "qc_supplier"("status", "name");

ALTER TABLE "qc_supplier" ENABLE ROW LEVEL SECURITY;
