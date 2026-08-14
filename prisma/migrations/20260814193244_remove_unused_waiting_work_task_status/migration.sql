-- El estado WAITING no forma parte del flujo operativo de tareas.
-- Si existieran registros antiguos, vuelven a PENDING antes de retirar el valor.
UPDATE "work_task" SET "status" = 'PENDING' WHERE "status" = 'WAITING';

ALTER TYPE "WorkTaskStatus" RENAME TO "WorkTaskStatus_old";

CREATE TYPE "WorkTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');

ALTER TABLE "work_task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "work_task"
  ALTER COLUMN "status" TYPE "WorkTaskStatus"
  USING "status"::text::"WorkTaskStatus";
ALTER TABLE "work_task" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "WorkTaskStatus_old";
