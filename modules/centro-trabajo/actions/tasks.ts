"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/helpers";
import { sendPushToModule, sendPushToUsers } from "@/lib/mobile/push";

const taskSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título más descriptivo.").max(160),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  sourceModule: z.string().trim().min(1).max(50),
  sourceType: z.string().trim().max(80).optional().or(z.literal("")),
  sourceId: z.string().trim().max(120).optional().or(z.literal("")),
  sourceCode: z.string().trim().max(120).optional().or(z.literal("")),
  sourceUrl: z.string().trim().max(300).optional().or(z.literal("")),
  assigneeId: z.string().trim().max(40).optional().or(z.literal("")),
  assigneeIds: z.string().optional().or(z.literal("")),
  assignmentMode: z.enum(["SINGLE", "MULTIPLE"]).default("SINGLE"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  dueAt: z.string().optional().or(z.literal("")),
  progressTotal: z.coerce.number().int().min(1).max(1000000).optional().or(z.literal("")),
});

const statusSchema = z.enum(["PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"]);

async function actor() {
  const user = await requirePermission("centro-trabajo.write");
  if (!user.id) throw new Error("La sesión no tiene un usuario persistido.");
  const persisted = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, roleCode: true, allowedModules: true, status: true } });
  if (!persisted || persisted.status !== "ACTIVE") throw new Error("El usuario no está activo.");
  return persisted;
}

function canAccessTask(user: { id: string; roleCode: string; allowedModules: string[] }, task: { creatorId: string; assigneeId: string | null; sourceModule: string }) {
  return user.roleCode === "ADMIN" || task.creatorId === user.id || task.assigneeId === user.id || user.allowedModules.includes(task.sourceModule);
}

async function parseEligibleAssignees(raw: string | undefined, actorId: string, roleCode: string) {
  let ids = raw ? z.array(z.string().min(1).max(40)).parse(JSON.parse(raw)) : [];
  ids = [...new Set(ids)];
  if (roleCode !== "ADMIN") ids = [actorId];
  if (ids.length > 0) {
    const eligible = await prisma.user.findMany({ where: { id: { in: ids }, status: "ACTIVE", allowedModules: { has: "centro-trabajo" } }, select: { id: true } });
    if (eligible.length !== ids.length) throw new Error("Solo puedes asignar la tarea a usuarios activos con Centro de trabajo habilitado.");
  }
  return ids;
}

function parseDueDate(value: string | undefined) {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) throw new Error("La fecha límite no es válida.");
  const parsed = new Date(`${dateOnly}T23:59:59.999-04:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha límite no es válida.");
  return parsed;
}

export async function createWorkTaskAction(input: unknown) {
  const user = await actor();
  const parsed = taskSchema.parse(input);
  if (user.roleCode !== "ADMIN" && !user.allowedModules.includes(parsed.sourceModule)) throw new Error("No tienes acceso al módulo relacionado.");
  const dueAt = parseDueDate(parsed.dueAt) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Las tareas manuales nuevas siempre nacen disponibles; los responsables las toman desde la lista.
  const requestedAssigneeIds: string[] = [];
  const created = await prisma.workTask.create({
    data: {
      title: parsed.title,
      description: parsed.description || null,
      sourceModule: parsed.sourceModule,
      sourceType: parsed.sourceType || null,
      sourceId: parsed.sourceId || null,
      sourceCode: parsed.sourceCode || null,
      sourceUrl: parsed.sourceUrl || null,
      creatorId: user.id,
      assignmentMode: parsed.assignmentMode,
      assigneeId: requestedAssigneeIds[0] ?? null,
      priority: parsed.priority,
      dueAt,
      progressTotal: parsed.progressTotal === "" || parsed.progressTotal === undefined ? null : Number(parsed.progressTotal),
      assignees: { create: requestedAssigneeIds.map((userId) => ({ userId, assignedById: user.id })) },
      events: { create: { actorId: user.id, type: "CREATED", afterData: { title: parsed.title, sourceModule: parsed.sourceModule } } },
    },
  });
  await logAudit({ userId: user.id, action: "work_task.create", module: "centro-trabajo", entityType: "work_task", entityId: created.id, afterData: { title: created.title, sourceModule: created.sourceModule, priority: created.priority } });
  if (requestedAssigneeIds.length) {
    await sendPushToUsers(requestedAssigneeIds, {
      title: "Nueva tarea asignada",
      body: created.title,
      route: created.sourceUrl || "/centro-trabajo",
      type: "work_task.assigned",
    });
  } else {
    await sendPushToModule(parsed.sourceModule, {
      title: "Nueva tarea disponible",
      body: created.title,
      route: created.sourceUrl || "/centro-trabajo",
      type: "work_task.available",
    }, [user.id]);
  }
  revalidatePath("/centro-trabajo");
  return { success: true, id: created.id };
}

export async function updateWorkTaskAction(taskId: string, input: unknown) {
  const user = await actor();
  const parsed = taskSchema.parse(input);
  const existing = await prisma.workTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!existing || user.roleCode !== "ADMIN") throw new Error("Solo el administrador puede editar esta tarea.");
  if (existing.kind === "AUTOMATIC") throw new Error("Las tareas automáticas se actualizan desde su módulo de origen.");
  if (!user.allowedModules.includes(parsed.sourceModule) && user.roleCode !== "ADMIN") throw new Error("No tienes acceso al módulo relacionado.");
  const dueAt = parseDueDate(parsed.dueAt);
  const assigneeIds = await parseEligibleAssignees(parsed.assigneeIds, user.id, user.roleCode);
  const assignmentMode = existing.assignmentMode === "MULTIPLE" && parsed.assignmentMode === "SINGLE" ? existing.assignmentMode : parsed.assignmentMode;
  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.workTask.update({ where: { id: taskId }, data: { title: parsed.title, description: parsed.description || null, sourceModule: parsed.sourceModule, sourceType: parsed.sourceType || null, sourceId: parsed.sourceId || null, sourceCode: parsed.sourceCode || null, sourceUrl: parsed.sourceUrl || null, priority: parsed.priority, assignmentMode, dueAt, progressTotal: parsed.progressTotal === "" || parsed.progressTotal === undefined ? null : Number(parsed.progressTotal), assigneeId: assigneeIds[0] ?? null, assignees: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId, assignedById: user.id })) }, events: { create: { actorId: user.id, type: "ASSIGNED", note: "Tarea editada por el administrador.", beforeData: { title: existing.title, priority: existing.priority, assigneeIds: existing.assignees.map((assignment) => assignment.userId) }, afterData: { title: parsed.title, priority: parsed.priority, assignmentMode, assigneeIds } } } } });
    return task;
  });
  await logAudit({ userId: user.id, action: "work_task.update", module: "centro-trabajo", entityType: "work_task", entityId: updated.id, beforeData: { title: existing.title, priority: existing.priority, assigneeIds: existing.assignees.map((assignment) => assignment.userId) }, afterData: { title: updated.title, priority: updated.priority, assigneeIds } });
  const previousAssigneeIds = new Set(existing.assignees.map((assignment) => assignment.userId));
  const newlyAssignedIds = assigneeIds.filter((id) => !previousAssigneeIds.has(id));
  await sendPushToUsers(newlyAssignedIds, {
    title: "Nueva tarea asignada",
    body: updated.title,
    route: updated.sourceUrl || "/centro-trabajo",
    type: "work_task.assigned",
  });
  revalidatePath("/centro-trabajo");
  return { success: true };
}

export async function deleteWorkTaskAction(taskId: string) {
  const user = await actor();
  if (user.roleCode !== "ADMIN") throw new Error("Solo el administrador puede eliminar tareas.");

  const task = await prisma.workTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("La tarea ya no existe.");
  if (task.kind === "AUTOMATIC") throw new Error("Las tareas automáticas de QC no se pueden eliminar desde aquí.");

  await prisma.workTask.delete({ where: { id: taskId } });
  await logAudit({
    userId: user.id,
    action: "work_task.delete",
    module: "centro-trabajo",
    entityType: "work_task",
    entityId: task.id,
    beforeData: { title: task.title, sourceModule: task.sourceModule, priority: task.priority },
  });
  revalidatePath("/centro-trabajo");
  return { success: true };
}

export async function updateWorkTaskStatusAction(taskId: string, nextStatus: string) {
  const user = await actor();
  const status = statusSchema.parse(nextStatus);
  const task = await prisma.workTask.findUnique({ where: { id: taskId }, select: { id: true, title: true, status: true, startedAt: true, creatorId: true, assigneeId: true, sourceUrl: true, sourceModule: true } });
  if (!task || !canAccessTask(user, task)) throw new Error("No puedes modificar esta tarea.");
  const completedAt = status === "COMPLETED" ? new Date() : null;
  const updated = await prisma.workTask.update({ where: { id: taskId }, data: { status, startedAt: status === "IN_PROGRESS" && !task.startedAt ? new Date() : undefined, completedAt, events: { create: { actorId: user.id, type: status === "COMPLETED" ? "COMPLETED" : "STATUS_CHANGED", beforeData: { status: task.status }, afterData: { status }, } } } });
  await logAudit({ userId: user.id, action: "work_task.status.update", module: "centro-trabajo", entityType: "work_task", entityId: task.id, beforeData: { status: task.status }, afterData: { status: updated.status } });
  const recipients = [task.creatorId, task.assigneeId].filter((id): id is string => Boolean(id && id !== user.id));
  if (recipients.length) {
    await sendPushToUsers(recipients, {
      title: updated.status === "COMPLETED" ? "Tarea completada" : "Estado de tarea actualizado",
      body: `${task.title}: ${updated.status === "COMPLETED" ? "completada" : updated.status.toLowerCase().replaceAll("_", " ")}.`,
      route: task.sourceUrl || "/centro-trabajo",
      type: updated.status === "COMPLETED" ? "work_task.completed" : "work_task.status_changed",
    });
  }
  revalidatePath("/centro-trabajo");
  return { success: true };
}

export async function claimWorkTaskAction(taskId: string) {
  const user = await actor();
  const task = await prisma.workTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!task || !user.allowedModules.includes(task.sourceModule) && user.roleCode !== "ADMIN") throw new Error("No puedes coger esta tarea.");
  if (["COMPLETED", "CANCELLED"].includes(task.status)) throw new Error("Esta tarea ya no está disponible.");
  if (task.assignees.some((assignment) => assignment.userId === user.id)) return { success: true };
  if (task.assignmentMode === "SINGLE" && task.assignees.length > 0) throw new Error("Esta tarea ya fue cogida por otra persona.");

  await prisma.$transaction(async (tx) => {
    await tx.workTaskAssignee.create({ data: { taskId, userId: user.id, assignedById: user.id } });
    await tx.workTask.update({ where: { id: taskId }, data: { assigneeId: task.assigneeId ?? user.id, status: task.status === "PENDING" ? "IN_PROGRESS" : undefined, startedAt: task.status === "PENDING" && !task.startedAt ? new Date() : undefined, events: { create: { actorId: user.id, type: "ASSIGNED", note: task.assignmentMode === "MULTIPLE" ? "La tarea fue cogida por un integrante del equipo." : "La tarea fue cogida.", afterData: { userId: user.id, assignmentMode: task.assignmentMode } } } } });
  });
  await logAudit({ userId: user.id, action: "work_task.claim", module: "centro-trabajo", entityType: "work_task", entityId: task.id, afterData: { assignmentMode: task.assignmentMode } });
  if (task.creatorId !== user.id) {
    await sendPushToUsers([task.creatorId], {
      title: "Tarea tomada",
      body: `${user.id === task.assigneeId ? "El responsable" : "Un integrante"} tomó la tarea: ${task.title}.`,
      route: task.sourceUrl || "/centro-trabajo",
      type: "work_task.claimed",
    });
  }
  revalidatePath("/centro-trabajo");
  return { success: true };
}

export async function addWorkTaskCommentAction(taskId: string, note: string) {
  const user = await actor();
  const cleanNote = z.string().trim().min(1).max(2000).parse(note);
  const task = await prisma.workTask.findUnique({ where: { id: taskId } });
  if (!task || !canAccessTask(user, task)) throw new Error("No puedes comentar esta tarea.");
  await prisma.workTaskEvent.create({ data: { taskId, actorId: user.id, type: "COMMENTED", note: cleanNote } });
  await logAudit({ userId: user.id, action: "work_task.comment.create", module: "centro-trabajo", entityType: "work_task", entityId: task.id, afterData: { note: cleanNote } });
  revalidatePath("/centro-trabajo");
  return { success: true };
}
