ALTER TABLE "goods_receipt"
  ADD COLUMN "warehouse_imported_at" TIMESTAMP(3),
  ADD COLUMN "warehouse_imported_by" TEXT;
