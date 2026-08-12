-- 20260812_add_withdrawal_redeem.sql
-- Validador de baucher (port de System): token de seguridad único por retiro
-- + fecha/admin que lo canjeó (marcó como pagado).

ALTER TABLE wallet_ledger_entry ADD COLUMN IF NOT EXISTS secure_token VARCHAR(64);
ALTER TABLE wallet_ledger_entry ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP;
ALTER TABLE wallet_ledger_entry ADD COLUMN IF NOT EXISTS redeemed_by_id TEXT;

-- Un token único por retiro (idempotencia + validación)
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_entry_secure_token_key
  ON wallet_ledger_entry (secure_token)
  WHERE secure_token IS NOT NULL;

-- Índice para listar retiros pendientes de canje (description ILIKE + redeemed_at NULL)
CREATE INDEX IF NOT EXISTS wallet_ledger_entry_redeemed_at_idx
  ON wallet_ledger_entry (redeemed_at)
  WHERE redeemed_at IS NULL;
