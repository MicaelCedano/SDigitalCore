-- Imágenes de referencia por modelo para Control de Calidad (fórmula SDigitalSystem).
-- Claves (brand, model) siempre en mayúsculas para colapsar duplicados por casing.
CREATE TABLE IF NOT EXISTS "qc_model_image" (
  "id" TEXT NOT NULL,
  "brand" VARCHAR(100) NOT NULL,
  "model" VARCHAR(150) NOT NULL,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qc_model_image_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "qc_model_image_brand_model_key"
  ON "qc_model_image"("brand", "model");
