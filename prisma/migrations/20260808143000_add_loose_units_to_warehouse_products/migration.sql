-- Añade equipos individuales recibidos sin caja sin alterar el stock de cajas.
ALTER TABLE "warehouse_product"
  ADD COLUMN IF NOT EXISTS "unidades_sueltas" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "warehouse_product"
  ADD CONSTRAINT "warehouse_product_unidades_sueltas_nonnegative"
  CHECK ("unidades_sueltas" >= 0);

UPDATE "warehouse_product"
SET "cantidad" = ("cajas" * "unidades_por_caja") + "unidades_sueltas";
