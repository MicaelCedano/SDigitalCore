CREATE TYPE "WorkTaskAssignmentMode" AS ENUM ('SINGLE', 'MULTIPLE');

ALTER TABLE "work_task"
ADD COLUMN "assignment_mode" "WorkTaskAssignmentMode" NOT NULL DEFAULT 'SINGLE';
