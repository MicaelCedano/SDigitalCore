-- Indices for the most frequent dashboard filters and orderings.
-- Applied to Supabase project SDigitalCore as migration 20260825041825.

CREATE INDEX IF NOT EXISTS "access_request_status_created_at_idx"
  ON "access_request" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "audit_log_action_created_at_idx"
  ON "audit_log" ("action", "created_at");

CREATE INDEX IF NOT EXISTS "goods_receipt_status_received_at_idx"
  ON "goods_receipt" ("status", "received_at");

CREATE INDEX IF NOT EXISTS "invoice_created_at_idx"
  ON "invoice" ("created_at");

CREATE INDEX IF NOT EXISTS "invoice_status_created_at_idx"
  ON "invoice" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "price_list_item_status_updated_at_idx"
  ON "price_list_item" ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "price_list_item_status_active_sort_idx"
  ON "price_list_item" ("status", "en_lista_activa", "orden_lista");

CREATE INDEX IF NOT EXISTS "wallet_ledger_entry_status_redeemed_created_idx"
  ON "wallet_ledger_entry" ("status", "redeemed_at", "created_at");

CREATE INDEX IF NOT EXISTS "warranty_case_archived_status_created_idx"
  ON "warranty_case" ("archived_at", "status", "created_at");

CREATE INDEX IF NOT EXISTS "warehouse_request_status_created_at_idx"
  ON "warehouse_request" ("status", "created_at");
