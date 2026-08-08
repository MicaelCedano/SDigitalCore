-- Lista de precios: inventario local, lista activa, marcas y logo.
-- Aplicar manualmente en Supabase después de revisar el SQL.

CREATE TABLE IF NOT EXISTS "price_list_item" (
  "id" TEXT NOT NULL,
  "sku" TEXT,
  "modelo" TEXT NOT NULL,
  "categoria" TEXT NOT NULL DEFAULT 'Celulares',
  "marca" TEXT,
  "capacidad" TEXT,
  "precio_costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "precio_mayorista" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "precio_detallista" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "precio_minimo" DOUBLE PRECISION,
  "notas" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "en_lista_activa" BOOLEAN NOT NULL DEFAULT false,
  "orden_lista" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_list_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "price_list_item_sku_key" ON "price_list_item"("sku");

ALTER TABLE "price_list_item"
  ADD COLUMN IF NOT EXISTS "en_lista_activa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "orden_lista" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "price_list_brand" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#111827',
  "orden" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_list_brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "price_list_brand_nombre_key" ON "price_list_brand"("nombre");

CREATE TABLE IF NOT EXISTS "price_list_setting" (
  "clave" TEXT NOT NULL,
  "valor" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_list_setting_pkey" PRIMARY KEY ("clave")
);

CREATE INDEX IF NOT EXISTS "price_list_item_active_order_idx"
  ON "price_list_item"("en_lista_activa", "orden_lista");

ALTER TABLE "price_list_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_list_brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_list_setting" ENABLE ROW LEVEL SECURITY;
