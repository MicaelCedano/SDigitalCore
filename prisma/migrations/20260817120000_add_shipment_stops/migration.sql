CREATE TYPE "shipment_stop_status" AS ENUM ('PENDING', 'ARRIVED');

CREATE TABLE "shipment_stop" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(400) NOT NULL,
    "maps_url" VARCHAR(1000),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "status" "shipment_stop_status" NOT NULL DEFAULT 'PENDING',
    "arrived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_stop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipment_stop_shipment_id_status_idx" ON "shipment_stop"("shipment_id", "status");

ALTER TABLE "shipment_stop" ADD CONSTRAINT "shipment_stop_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipment_stop" ENABLE ROW LEVEL SECURITY;
