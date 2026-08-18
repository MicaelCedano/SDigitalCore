import { prisma } from "@/lib/db/prisma";
import { sendPushToUsers } from "@/lib/mobile/push";

type QcBatchForTasks = {
  id: string;
  batchNumber: string;
  status: string;
  totalDevices: number;
  reviewedDevices: number;
  createdAt: Date;
  devices: { assignedToId: string | null; inspections: { status: string; createdAt: Date }[] }[];
};

/**
 * Proyecta el trabajo pendiente de QC al Centro de trabajo.
 * Es idempotente: volver a abrir el Centro no duplica tareas.
 */
export async function syncQcWorkTasks(actorId: string) {
  const batches = await prisma.qcRevisionBatch.findMany({
    where: { status: { in: ["PENDING_REVIEW", "IN_REVIEW"] } },
    select: {
      id: true,
      batchNumber: true,
      status: true,
      totalDevices: true,
      reviewedDevices: true,
      createdAt: true,
      devices: {
        select: {
          assignedToId: true,
          inspections: {
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, createdAt: true },
          },
        },
      },
    },
  });

  const admin = await prisma.user.findFirst({ where: { roleCode: "ADMIN", status: "ACTIVE" }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const creatorId = admin?.id ?? actorId;
  const desired = new Set<string>();

  for (const batch of batches as QcBatchForTasks[]) {
    const globalKey = `${batch.id}:global`;
    desired.add(globalKey);
    await upsertQcTask({
      sourceType: "qc_revision_batch_global",
      sourceId: batch.id,
      assigneeId: null,
      creatorId,
      title: `Completar revisión QC · ${batch.batchNumber}`,
      description: `${batch.reviewedDevices}/${batch.totalDevices} equipos revisados. Esta tarea está disponible para el equipo QC.`,
      progressDone: batch.reviewedDevices,
      progressTotal: batch.totalDevices,
      status: "IN_PROGRESS",
      sourceCode: batch.batchNumber,
      sourceUrl: `/qc/lotes/${batch.id}`,
    });

    const byAssignee = new Map<string, { done: number; total: number }>();
    const existingTasks = await prisma.workTask.findMany({
      where: {
        sourceType: "qc_revision_batch_assigned",
        sourceId: batch.id,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { assigneeId: true, createdAt: true },
    });
    const taskStartedAt = new Map(
      existingTasks
        .filter((task): task is typeof task & { assigneeId: string } => Boolean(task.assigneeId))
        .map((task) => [task.assigneeId, task.createdAt]),
    );
    for (const device of batch.devices) {
      if (!device.assignedToId) continue;
      const current = byAssignee.get(device.assignedToId) ?? { done: 0, total: 0 };
      current.total += 1;
      const startedAt = taskStartedAt.get(device.assignedToId);
      if (device.inspections.some((inspection) => !startedAt || inspection.createdAt >= startedAt)) current.done += 1;
      byAssignee.set(device.assignedToId, current);
    }
    for (const [assigneeId, progress] of byAssignee) {
      const key = `${batch.id}:${assigneeId}`;
      desired.add(key);
      await upsertQcTask({
        sourceType: "qc_revision_batch_assigned",
        sourceId: batch.id,
        assigneeId,
        creatorId,
        title: `Revisar lote QC asignado · ${batch.batchNumber}`,
        description: `Tienes ${progress.total} equipo${progress.total === 1 ? "" : "s"} asignado${progress.total === 1 ? "" : "s"} en este lote.`,
        progressDone: progress.done,
        progressTotal: progress.total,
        status: progress.done >= progress.total && progress.total > 0 ? "COMPLETED" : "IN_PROGRESS",
        sourceCode: batch.batchNumber,
        sourceUrl: `/qc/lotes/${batch.id}`,
      });
    }
  }

  const existing = await prisma.workTask.findMany({
    where: { sourceType: { in: ["qc_revision_batch_global", "qc_revision_batch_assigned"] }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    select: { id: true, sourceId: true, sourceType: true, assigneeId: true },
  });
  for (const task of existing) {
    const key = `${task.sourceId}:${task.sourceType === "qc_revision_batch_global" ? "global" : task.assigneeId}`;
    if (!desired.has(key)) await prisma.workTask.update({ where: { id: task.id }, data: { status: "CANCELLED", completedAt: null } });
  }
}

async function upsertQcTask(input: {
  sourceType: string; sourceId: string; assigneeId: string | null; creatorId: string; title: string; description: string; progressDone: number; progressTotal: number; status: "IN_PROGRESS" | "COMPLETED"; sourceCode: string; sourceUrl: string;
}) {
  const existing = await prisma.workTask.findFirst({ where: { sourceType: input.sourceType, sourceId: input.sourceId, assigneeId: input.assigneeId } });
  if (existing) {
    await prisma.workTask.update({ where: { id: existing.id }, data: { title: input.title, description: input.description, status: input.status, startedAt: input.status === "IN_PROGRESS" ? existing.startedAt ?? new Date() : existing.startedAt, completedAt: input.status === "COMPLETED" ? existing.completedAt ?? new Date() : null, progressDone: input.progressDone, progressTotal: input.progressTotal, sourceCode: input.sourceCode, sourceUrl: input.sourceUrl, assignees: input.assigneeId ? { connectOrCreate: { where: { taskId_userId: { taskId: existing.id, userId: input.assigneeId } }, create: { userId: input.assigneeId, assignedById: input.creatorId } } } : undefined } });
    return;
  }
  await prisma.workTask.create({
    data: {
      title: input.title,
      description: input.description,
      kind: "AUTOMATIC",
      status: input.status,
      priority: input.progressDone < input.progressTotal ? "HIGH" : "NORMAL",
      sourceModule: "qc",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCode: input.sourceCode,
      sourceUrl: input.sourceUrl,
      creatorId: input.creatorId,
      assigneeId: input.assigneeId,
      progressDone: input.progressDone,
      progressTotal: input.progressTotal,
      startedAt: input.status === "IN_PROGRESS" ? new Date() : null,
      completedAt: input.status === "COMPLETED" ? new Date() : null,
      assignees: input.assigneeId ? { create: { userId: input.assigneeId, assignedById: input.creatorId } } : undefined,
      events: { create: { actorId: input.creatorId, type: "CREATED", afterData: { sourceType: input.sourceType, sourceId: input.sourceId, assigneeId: input.assigneeId } } },
    },
  });
  if (input.assigneeId) {
    await sendPushToUsers([input.assigneeId], {
      title: "Lote QC asignado",
      body: `${input.title}. Tienes ${input.progressTotal - input.progressDone} equipo(s) pendiente(s).`,
      route: input.sourceUrl,
      type: "qc_batch.assigned",
    });
  }
}
