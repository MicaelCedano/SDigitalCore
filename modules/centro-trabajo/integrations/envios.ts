import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { sendPushToUsers } from "@/lib/mobile/push";

const SHIPMENT_TASK_SOURCE = "shipment_delivery";

type ShipmentTaskInput = {
  shipmentId: string;
  code: string;
  title: string;
  driverId: string;
  creatorId: string;
  destination: string;
  stopCount: number;
};

export async function syncShipmentWorkTasks(actorId: string) {
  const shipments = await prisma.shipment.findMany({
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] }, driverId: { not: null } },
    select: { id: true, code: true, title: true, destination: true, driverId: true, stops: { select: { id: true } } },
  });
  for (const shipment of shipments) {
    if (!shipment.driverId) continue;
    await createShipmentWorkTask({ shipmentId: shipment.id, code: shipment.code, title: shipment.title, driverId: shipment.driverId, creatorId: actorId, destination: shipment.destination, stopCount: shipment.stops.length });
  }
}

export async function createShipmentWorkTask(input: ShipmentTaskInput) {
  const existing = await prisma.workTask.findFirst({ where: { sourceType: SHIPMENT_TASK_SOURCE, sourceId: input.shipmentId } });
  if (existing) return existing;

  const task = await prisma.workTask.create({
    data: {
      title: `Realizar envío · ${input.title}`,
      description: `Viaje ${input.code}: ${input.stopCount} parada${input.stopCount === 1 ? "" : "s"} y regreso a Yacelltech. Destino: ${input.destination}.`,
      kind: "AUTOMATIC",
      assignmentMode: "SINGLE",
      status: "IN_PROGRESS",
      priority: "HIGH",
      sourceModule: "envios",
      sourceType: SHIPMENT_TASK_SOURCE,
      sourceId: input.shipmentId,
      sourceCode: input.code,
      sourceUrl: "/envios",
      creatorId: input.creatorId,
      assigneeId: input.driverId,
      progressTotal: input.stopCount + 1,
      assignees: { create: { userId: input.driverId, assignedById: input.creatorId } },
      events: { create: { actorId: input.creatorId, type: "CREATED", note: "Viaje asignado automáticamente desde Envíos.", afterData: { shipmentId: input.shipmentId, driverId: input.driverId } } },
    },
  });

  await logAudit({ userId: input.creatorId, action: "shipment.work_task.create", module: "envios", entityType: "work_task", entityId: task.id, afterData: { shipmentId: input.shipmentId, driverId: input.driverId, sourceType: SHIPMENT_TASK_SOURCE } });
  await sendPushToUsers([input.driverId], { title: "Viaje asignado", body: task.title, route: "/envios", type: "shipment.work_task.assigned" });
  return task;
}

export async function completeShipmentWorkTask(shipmentId: string, nextStatus: "COMPLETED" | "CANCELLED", actorId: string) {
  const task = await prisma.workTask.findFirst({ where: { sourceType: SHIPMENT_TASK_SOURCE, sourceId: shipmentId, status: { notIn: ["COMPLETED", "CANCELLED"] } }, select: { id: true, title: true, status: true, creatorId: true, assigneeId: true } });
  if (!task) return false;

  const completedAt = new Date();
  const updated = await prisma.workTask.update({ where: { id: task.id }, data: { status: nextStatus, completedAt, events: { create: { actorId, type: nextStatus === "COMPLETED" ? "COMPLETED" : "STATUS_CHANGED", note: nextStatus === "COMPLETED" ? "El envío regresó a Yacelltech." : "El viaje fue cancelado.", beforeData: { status: task.status }, afterData: { status: nextStatus } } } } });
  await logAudit({ userId: actorId, action: "shipment.work_task.complete", module: "envios", entityType: "work_task", entityId: task.id, beforeData: { status: task.status }, afterData: { status: updated.status, shipmentId } });
  await sendPushToUsers([task.creatorId, task.assigneeId].filter((id): id is string => Boolean(id && id !== actorId)), { title: nextStatus === "COMPLETED" ? "Viaje completado" : "Viaje cancelado", body: task.title, route: "/centro-trabajo", type: nextStatus === "COMPLETED" ? "shipment.work_task.completed" : "shipment.work_task.cancelled" });
  return true;
}
