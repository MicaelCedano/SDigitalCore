CREATE TABLE "work_task_assignee" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "assigned_by_id" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_task_assignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_task_assignee_task_id_user_id_key" ON "work_task_assignee"("task_id", "user_id");
CREATE INDEX "work_task_assignee_user_id_assigned_at_idx" ON "work_task_assignee"("user_id", "assigned_at");

ALTER TABLE "work_task_assignee" ADD CONSTRAINT "work_task_assignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_task_assignee" ADD CONSTRAINT "work_task_assignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_task_assignee" ADD CONSTRAINT "work_task_assignee_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "work_task_assignee" ("id", "task_id", "user_id", "assigned_by_id")
SELECT 'legacy_' || "id", "id", "assignee_id", "creator_id"
FROM "work_task"
WHERE "assignee_id" IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;
