-- Enable pg_trgm extension for fast LIKE / contains substring searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram Indexes for instant global IMEI searches
CREATE INDEX IF NOT EXISTS idx_warranty_case_imei_trgm ON warranty_case USING gin (imei gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_device_unit_imei_trgm ON device_unit USING gin (imei gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_item_imei_trgm ON goods_receipt_item USING gin (imei_or_serial gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_stock_count_item_imeis_trgm ON stock_count_item USING gin (scanned_imeis gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_repair_job_item_imei_trgm ON repair_job_item USING gin (imei gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_unlock_record_imei_trgm ON unlock_record USING gin (imei gin_trgm_ops);
