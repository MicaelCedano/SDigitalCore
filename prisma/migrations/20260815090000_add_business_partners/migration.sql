CREATE TYPE "business_partner_kind" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
CREATE TYPE "business_partner_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "business_partner" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "kind" "business_partner_kind" NOT NULL,
    "tax_id" VARCHAR(40),
    "contact_name" VARCHAR(160),
    "phone" VARCHAR(40),
    "email" VARCHAR(200),
    "address" VARCHAR(300),
    "notes" TEXT,
    "status" "business_partner_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_partner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_partner_name_kind_key" ON "business_partner"("name", "kind");
CREATE INDEX "business_partner_kind_status_name_idx" ON "business_partner"("kind", "status", "name");
CREATE INDEX "business_partner_phone_idx" ON "business_partner"("phone");
CREATE INDEX "business_partner_tax_id_idx" ON "business_partner"("tax_id");
ALTER TABLE "business_partner" ADD CONSTRAINT "business_partner_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_partner" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "warranty_case" ADD COLUMN "customer_id" TEXT;
CREATE INDEX "warranty_case_customer_id_idx" ON "warranty_case"("customer_id");
ALTER TABLE "warranty_case" ADD CONSTRAINT "warranty_case_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "business_partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
