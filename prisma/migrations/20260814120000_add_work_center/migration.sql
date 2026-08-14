CREATE TYPE "WorkTaskKind" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "WorkTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'WAITING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "WorkTaskEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'DUE_DATE_CHANGED', 'COMMENTED', 'PROGRESS_UPDATED', 'COMPLETED');

CREATE TABLE "work_task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" "WorkTaskKind" NOT NULL DEFAULT 'MANUAL',
  "status" "WorkTaskStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "WorkTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "source_module" TEXT NOT NULL,
  "source_type" TEXT,
  "source_id" TEXT,
  "source_code" TEXT,
  "source_url" TEXT,
  "creator_id" TEXT NOT NULL,
  "assignee_id" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "progress_done" INTEGER NOT NULL DEFAULT 0,
  "progress_total" INTEGER,
  "recurrence_rule" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_task_event" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "type" "WorkTaskEventType" NOT NULL,
  "note" TEXT,
  "before_data" JSONB,
  "after_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_task_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_task_assignee_id_status_due_at_idx" ON "work_task"("assignee_id", "status", "due_at");
CREATE INDEX "work_task_source_module_status_due_at_idx" ON "work_task"("source_module", "status", "due_at");
CREATE INDEX "work_task_creator_id_created_at_idx" ON "work_task"("creator_id", "created_at");
CREATE INDEX "work_task_event_task_id_created_at_idx" ON "work_task_event"("task_id", "created_at");
CREATE INDEX "work_task_event_actor_id_created_at_idx" ON "work_task_event"("actor_id", "created_at");

ALTER TABLE "work_task" ADD CONSTRAINT "work_task_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_task" ADD CONSTRAINT "work_task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_task_event" ADD CONSTRAINT "work_task_event_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_task_event" ADD CONSTRAINT "work_task_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
