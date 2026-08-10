-- Restore the constraint required by Prisma's warrantyDailySequence.upsert().
-- This is intentionally non-destructive: if duplicate rows already exist,
-- PostgreSQL will stop here so they can be reviewed before applying the index.
CREATE UNIQUE INDEX IF NOT EXISTS "warranty_daily_sequence_sequence_date_sequence_type_key"
ON "warranty_daily_sequence"("sequence_date", "sequence_type");
