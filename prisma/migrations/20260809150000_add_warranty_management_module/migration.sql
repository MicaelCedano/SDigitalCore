CREATE TYPE "warranty_status" AS ENUM ('RECEIVED','IN_REPAIR','RECEIVED_FROM_TECHNICIAN','SENT_TO_SUPPLIER','RECEIVED_FROM_SUPPLIER','DELIVERED','CREDIT_NOTE');
CREATE TYPE "warranty_event_type" AS ENUM ('CREATED','DETAILS_UPDATED','STATUS_CHANGED','ASSIGNED_TO_TECHNICIAN','RECEIVED_REPAIRED','RECEIVED_UNREPAIRED','SENT_TO_SUPPLIER','RECEIVED_FROM_SUPPLIER','DELIVERED_TO_CUSTOMER','CREDIT_NOTE_MARKED','ARCHIVED','RESTORED');
CREATE TYPE "warranty_document_type" AS ENUM ('INTAKE_RECEIPT','TECHNICIAN_ASSIGNMENT','TECHNICIAN_RECEIPT_REPAIRED','TECHNICIAN_RECEIPT_UNREPAIRED','SUPPLIER_SHIPMENT','SUPPLIER_RECEIPT','CUSTOMER_DELIVERY');

CREATE TABLE "warranty_case" (
  "id" TEXT NOT NULL, "case_code" TEXT NOT NULL, "imei" TEXT NOT NULL, "model" TEXT NOT NULL, "client_name" TEXT NOT NULL, "problem" TEXT NOT NULL,
  "status" "warranty_status" NOT NULL DEFAULT 'RECEIVED', "entry_date" DATE NOT NULL, "created_by_id" TEXT, "updated_by_id" TEXT,
  "assigned_technician_id" TEXT, "assigned_technician_name" TEXT, "current_supplier_name" TEXT, "archived_at" TIMESTAMP(3), "archived_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "warranty_case_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warranty_case_case_code_key" ON "warranty_case"("case_code");
CREATE INDEX "warranty_case_imei_created_at_idx" ON "warranty_case"("imei","created_at");
CREATE INDEX "warranty_case_status_entry_date_idx" ON "warranty_case"("status","entry_date");
CREATE INDEX "warranty_case_client_name_idx" ON "warranty_case"("client_name");
CREATE INDEX "warranty_case_archived_at_idx" ON "warranty_case"("archived_at");

CREATE TABLE "warranty_event" (
  "id" TEXT NOT NULL, "case_id" TEXT NOT NULL, "type" "warranty_event_type" NOT NULL, "from_status" "warranty_status", "to_status" "warranty_status",
  "actor_id" TEXT, "actor_name_snapshot" TEXT, "counterparty_name" TEXT, "reason" TEXT, "before_data" JSONB, "after_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "warranty_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "warranty_event_case_id_created_at_idx" ON "warranty_event"("case_id","created_at");

CREATE TABLE "warranty_document" (
  "id" TEXT NOT NULL, "document_code" TEXT NOT NULL, "type" "warranty_document_type" NOT NULL, "counterparty_name" TEXT NOT NULL,
  "document_date" DATE NOT NULL, "created_by_id" TEXT, "notes" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warranty_document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warranty_document_document_code_key" ON "warranty_document"("document_code");
CREATE INDEX "warranty_document_type_document_date_idx" ON "warranty_document"("type","document_date");

CREATE TABLE "warranty_document_item" (
  "id" TEXT NOT NULL, "document_id" TEXT NOT NULL, "case_id" TEXT NOT NULL, "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "warranty_document_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warranty_document_item_document_id_case_id_key" ON "warranty_document_item"("document_id","case_id");
CREATE INDEX "warranty_document_item_case_id_idx" ON "warranty_document_item"("case_id");

CREATE TABLE "warranty_daily_sequence" (
  "id" TEXT NOT NULL, "sequence_date" DATE NOT NULL, "sequence_type" TEXT NOT NULL, "last_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "warranty_daily_sequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warranty_daily_sequence_sequence_date_sequence_type_key" ON "warranty_daily_sequence"("sequence_date","sequence_type");

ALTER TABLE "warranty_case" ADD CONSTRAINT "warranty_case_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_case" ADD CONSTRAINT "warranty_case_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_case" ADD CONSTRAINT "warranty_case_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_case" ADD CONSTRAINT "warranty_case_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_event" ADD CONSTRAINT "warranty_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warranty_event" ADD CONSTRAINT "warranty_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_document" ADD CONSTRAINT "warranty_document_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranty_document_item" ADD CONSTRAINT "warranty_document_item_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "warranty_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warranty_document_item" ADD CONSTRAINT "warranty_document_item_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "warranty_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
