CREATE TYPE "repair_outcome" AS ENUM ('REPAIRED', 'UNREPAIRED');

ALTER TABLE "repair_job_item"
ADD COLUMN "resultado" "repair_outcome" NOT NULL DEFAULT 'REPAIRED';
