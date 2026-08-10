-- Los productos se archivan para preservar sus movimientos y solicitudes históricas.
ALTER TABLE "warehouse_product"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "warehouse_product_status_idx" ON "warehouse_product"("status");
