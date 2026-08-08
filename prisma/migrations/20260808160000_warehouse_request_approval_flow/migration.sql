CREATE TYPE "warehouse_request_type" AS ENUM ('ENTRY', 'EXIT');

ALTER TABLE "warehouse_request"
  ADD COLUMN "tipo" "warehouse_request_type" NOT NULL DEFAULT 'EXIT';

CREATE TABLE "warehouse_request_item" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "unidades" INTEGER NOT NULL,
  CONSTRAINT "warehouse_request_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouse_request_item_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "warehouse_request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "warehouse_request_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "warehouse_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "warehouse_request_item_request_id_product_id_key" ON "warehouse_request_item"("request_id", "product_id");