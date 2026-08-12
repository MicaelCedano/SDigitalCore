-- Fotos de defectos por equipo (fórmula SDigitalSystem: equipo_fotos).
-- Las fotos viven en el bucket privado "defectos-equipos" de Supabase Storage;
-- esta tabla guarda la referencia por equipo.
CREATE TABLE IF NOT EXISTS "device_photo" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_photo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_photo_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "device_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "device_photo_device_id_created_at_idx"
  ON "device_photo"("device_id", "created_at");
