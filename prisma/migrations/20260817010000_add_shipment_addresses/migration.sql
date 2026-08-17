CREATE TABLE "shipment_address" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(400) NOT NULL,
    "maps_url" VARCHAR(1000),
    "is_default_origin" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_address_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "shipment" ADD COLUMN "origin_address_id" TEXT;
ALTER TABLE "shipment" ADD COLUMN "destination_address_id" TEXT;

CREATE INDEX "shipment_address_status_name_idx" ON "shipment_address"("status", "name");
CREATE INDEX "shipment_origin_address_id_idx" ON "shipment"("origin_address_id");
CREATE INDEX "shipment_destination_address_id_idx" ON "shipment"("destination_address_id");

ALTER TABLE "shipment" ADD CONSTRAINT "shipment_origin_address_id_fkey" FOREIGN KEY ("origin_address_id") REFERENCES "shipment_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_destination_address_id_fkey" FOREIGN KEY ("destination_address_id") REFERENCES "shipment_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "shipment_address" ("id", "name", "address", "maps_url", "is_default_origin", "status", "created_at", "updated_at")
VALUES ('seed_yacelltech_origin', 'Yacelltech', 'Yacelltech', 'https://maps.app.goo.gl/jsW1hrZBWsYzpZEo8', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "shipment_address" ENABLE ROW LEVEL SECURITY;
