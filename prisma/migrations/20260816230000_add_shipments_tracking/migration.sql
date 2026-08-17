CREATE TYPE "shipment_status" AS ENUM ('DRAFT', 'READY', 'IN_TRANSIT', 'PAUSED', 'DELIVERED', 'CANCELLED');

CREATE TABLE "shipment" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "origin" VARCHAR(300) NOT NULL,
    "destination" VARCHAR(300) NOT NULL,
    "vehicle_label" VARCHAR(120),
    "notes" TEXT,
    "status" "shipment_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "started_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "last_latitude" DECIMAL(10,7),
    "last_longitude" DECIMAL(10,7),
    "last_accuracy_meters" DECIMAL(8,2),
    "last_speed_mps" DECIMAL(8,2),
    "last_heading" DECIMAL(6,2),
    "last_location_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipment_location" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy_meters" DECIMAL(8,2),
    "speed_mps" DECIMAL(8,2),
    "heading" DECIMAL(6,2),
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_code_key" ON "shipment"("code");
CREATE INDEX "shipment_status_last_location_at_idx" ON "shipment"("status", "last_location_at");
CREATE INDEX "shipment_driver_id_status_idx" ON "shipment"("driver_id", "status");
CREATE INDEX "shipment_location_shipment_id_recorded_at_idx" ON "shipment_location"("shipment_id", "recorded_at");
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_location" ADD CONSTRAINT "shipment_location_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipment_location" ENABLE ROW LEVEL SECURITY;
