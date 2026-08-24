-- Comprobante auditable de cada importación de recibo al almacén.
CREATE TYPE "warehouse_receipt_import_status" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "warehouse_receipt_import" (
    "id" TEXT NOT NULL,
    "import_number" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "imported_by" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "warehouse_receipt_import_status" NOT NULL DEFAULT 'ACTIVE',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,

    CONSTRAINT "warehouse_receipt_import_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouse_receipt_import_line" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "capacity" TEXT,
    "color" TEXT,
    "units_per_box" INTEGER NOT NULL,
    "boxes_count" INTEGER NOT NULL,
    "loose_units" INTEGER NOT NULL,
    "total_units" INTEGER NOT NULL,

    CONSTRAINT "warehouse_receipt_import_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_receipt_import_import_number_key" ON "warehouse_receipt_import"("import_number");
CREATE INDEX "warehouse_receipt_import_receipt_id_status_idx" ON "warehouse_receipt_import"("receipt_id", "status");
CREATE INDEX "warehouse_receipt_import_status_imported_at_idx" ON "warehouse_receipt_import"("status", "imported_at");
CREATE INDEX "warehouse_receipt_import_line_import_id_idx" ON "warehouse_receipt_import_line"("import_id");
CREATE INDEX "warehouse_receipt_import_line_product_id_idx" ON "warehouse_receipt_import_line"("product_id");

ALTER TABLE "warehouse_receipt_import"
  ADD CONSTRAINT "warehouse_receipt_import_receipt_id_fkey"
  FOREIGN KEY ("receipt_id") REFERENCES "goods_receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_receipt_import_line"
  ADD CONSTRAINT "warehouse_receipt_import_line_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "warehouse_receipt_import"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "warehouse_receipt_import_line_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "warehouse_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_receipt_import" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_receipt_import_line" ENABLE ROW LEVEL SECURITY;
