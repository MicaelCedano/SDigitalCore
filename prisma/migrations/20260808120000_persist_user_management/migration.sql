ALTER TABLE "user"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "role_code" TEXT NOT NULL DEFAULT 'VENTAS',
  ADD COLUMN "allowed_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TYPE "access_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "access_request" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "status" "access_request_status" NOT NULL DEFAULT 'PENDING',
  "assigned_role" TEXT,
  "custom_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_request_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_request_username_key" ON "access_request"("username");
CREATE UNIQUE INDEX "access_request_email_key" ON "access_request"("email");

CREATE TABLE "audit_log" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "before_data" JSONB,
  "after_data" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at");
CREATE INDEX "audit_log_module_created_at_idx" ON "audit_log"("module", "created_at");
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- Las sucursales deben proceder del catálogo real, nunca de valores de demostración.
ALTER TABLE "goods_receipt" ALTER COLUMN "branch" DROP DEFAULT;
ALTER TABLE "stock_count" ALTER COLUMN "branch" DROP DEFAULT;
ALTER TABLE "warehouse_request" ALTER COLUMN "sucursal" DROP DEFAULT;
ALTER TABLE "invoice" ALTER COLUMN "sucursal" DROP DEFAULT;
