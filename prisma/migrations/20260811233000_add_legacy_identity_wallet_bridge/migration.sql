CREATE TYPE "legacy_identity_match_status" AS ENUM (
    'UNMATCHED',
    'SUGGESTED',
    'LINKED_PENDING_CUTOVER',
    'TRANSFERRED',
    'CONFLICT',
    'EXCLUDED'
);

CREATE TYPE "legacy_migration_mode" AS ENUM ('DRY_RUN', 'APPLY', 'CUTOVER');
CREATE TYPE "legacy_migration_status" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'REVERSED');
CREATE TYPE "wallet_status" AS ENUM ('ACTIVE', 'FROZEN');
CREATE TYPE "wallet_ledger_entry_type" AS ENUM (
    'LEGACY_OPENING_BALANCE',
    'CREDIT',
    'DEBIT',
    'ADJUSTMENT',
    'REVERSAL'
);
CREATE TYPE "wallet_ledger_entry_status" AS ENUM ('POSTED', 'VOID');

CREATE TABLE "legacy_migration_batch" (
    "id" TEXT NOT NULL,
    "source_system" VARCHAR(80) NOT NULL,
    "mode" "legacy_migration_mode" NOT NULL,
    "status" "legacy_migration_status" NOT NULL DEFAULT 'RUNNING',
    "cutoff_at" TIMESTAMP(3),
    "source_user_count" INTEGER NOT NULL DEFAULT 0,
    "source_wallet_count" INTEGER NOT NULL DEFAULT 0,
    "source_transaction_count" INTEGER NOT NULL DEFAULT 0,
    "source_balance_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferred_user_count" INTEGER NOT NULL DEFAULT 0,
    "transferred_balance_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "checksum" VARCHAR(128),
    "reconciliation" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "legacy_migration_batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_user_identity" (
    "id" TEXT NOT NULL,
    "source_system" VARCHAR(80) NOT NULL,
    "source_user_id" VARCHAR(80) NOT NULL,
    "username_snapshot" VARCHAR(160) NOT NULL,
    "name_snapshot" VARCHAR(200),
    "email_snapshot" VARCHAR(240),
    "role_snapshot" VARCHAR(80),
    "active_snapshot" BOOLEAN NOT NULL DEFAULT true,
    "source_wallet_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "source_transaction_count" INTEGER NOT NULL DEFAULT 0,
    "match_status" "legacy_identity_match_status" NOT NULL DEFAULT 'UNMATCHED',
    "match_method" VARCHAR(80),
    "core_user_id" TEXT,
    "linked_by_id" TEXT,
    "linked_at" TIMESTAMP(3),
    "transferred_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batch_id" TEXT,
    CONSTRAINT "legacy_user_identity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_wallet_transaction" (
    "id" TEXT NOT NULL,
    "source_system" VARCHAR(80) NOT NULL,
    "source_transaction_id" VARCHAR(80) NOT NULL,
    "legacy_identity_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type_snapshot" VARCHAR(80) NOT NULL,
    "status_snapshot" VARCHAR(80),
    "description_snapshot" TEXT,
    "occurred_at" TIMESTAMP(3),
    "redeemed_snapshot" BOOLEAN,
    "batch_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legacy_wallet_transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'DOP',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "wallet_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_ledger_entry" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "wallet_ledger_entry_type" NOT NULL,
    "status" "wallet_ledger_entry_status" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "external_key" VARCHAR(180) NOT NULL,
    "actor_id" TEXT,
    "batch_id" TEXT,
    "reversal_of_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_ledger_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_ledger_entry_amount_nonzero" CHECK ("amount" <> 0)
);

CREATE UNIQUE INDEX "legacy_user_identity_source_system_source_user_id_key"
    ON "legacy_user_identity"("source_system", "source_user_id");
CREATE UNIQUE INDEX "legacy_user_identity_source_system_core_user_id_key"
    ON "legacy_user_identity"("source_system", "core_user_id");
CREATE INDEX "legacy_user_identity_match_status_last_synced_at_idx"
    ON "legacy_user_identity"("match_status", "last_synced_at");
CREATE INDEX "legacy_user_identity_username_snapshot_idx" ON "legacy_user_identity"("username_snapshot");
CREATE INDEX "legacy_user_identity_email_snapshot_idx" ON "legacy_user_identity"("email_snapshot");

CREATE UNIQUE INDEX "legacy_wallet_transaction_source_system_source_transaction_id_key"
    ON "legacy_wallet_transaction"("source_system", "source_transaction_id");
CREATE INDEX "legacy_wallet_transaction_legacy_identity_id_occurred_at_idx"
    ON "legacy_wallet_transaction"("legacy_identity_id", "occurred_at");

CREATE UNIQUE INDEX "wallet_user_id_key" ON "wallet"("user_id");
CREATE INDEX "wallet_status_updated_at_idx" ON "wallet"("status", "updated_at");
CREATE UNIQUE INDEX "wallet_ledger_entry_external_key_key" ON "wallet_ledger_entry"("external_key");
CREATE UNIQUE INDEX "wallet_ledger_entry_reversal_of_id_key" ON "wallet_ledger_entry"("reversal_of_id");
CREATE INDEX "wallet_ledger_entry_wallet_id_occurred_at_idx" ON "wallet_ledger_entry"("wallet_id", "occurred_at");
CREATE INDEX "wallet_ledger_entry_batch_id_idx" ON "wallet_ledger_entry"("batch_id");
CREATE INDEX "legacy_migration_batch_source_system_created_at_idx"
    ON "legacy_migration_batch"("source_system", "created_at");
CREATE INDEX "legacy_migration_batch_status_created_at_idx"
    ON "legacy_migration_batch"("status", "created_at");

ALTER TABLE "legacy_user_identity"
    ADD CONSTRAINT "legacy_user_identity_core_user_id_fkey"
    FOREIGN KEY ("core_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "legacy_user_identity_linked_by_id_fkey"
    FOREIGN KEY ("linked_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "legacy_user_identity_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "legacy_migration_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legacy_wallet_transaction"
    ADD CONSTRAINT "legacy_wallet_transaction_legacy_identity_id_fkey"
    FOREIGN KEY ("legacy_identity_id") REFERENCES "legacy_user_identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "legacy_wallet_transaction_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "legacy_migration_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet"
    ADD CONSTRAINT "wallet_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entry"
    ADD CONSTRAINT "wallet_ledger_entry_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "wallet_ledger_entry_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "wallet_ledger_entry_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "legacy_migration_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "wallet_ledger_entry_reversal_of_id_fkey"
    FOREIGN KEY ("reversal_of_id") REFERENCES "wallet_ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "legacy_migration_batch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_user_identity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_wallet_transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_ledger_entry" ENABLE ROW LEVEL SECURITY;
