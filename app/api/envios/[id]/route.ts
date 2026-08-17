import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { serializeShipment } from "@/modules/envios/data";
import { completeShipmentWorkTask } from "@/modules/centro-trabajo/integrations/envios";

const statusSchema = z.object({ status: z.enum(["READY", "IN_TRANSIT", "PAUSED", "DELIVERED", "CANCELLED"]) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("envios.read");
    const { id } = await context.params;
    const shipment = await prisma.shipment.findUnique({ where: { id }, include: { driver: { select: { id: true, name: true, username: true } }, locations: { orderBy: { recordedAt: "asc" }, take: 5000 }, stops: { orderBy: { createdAt: "asc" } } } });
    if (!shipment) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    return NextResponse.json({ shipment: serializeShipment(shipment) });
  } catch (error) {
    console.error("[envios] No se pudo cargar el envío", error);
    return NextResponse.json({ error: "No se pudo cargar el envío." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("envios.write");
    const { id } = await context.params;
    const parsed = statusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const existing = await prisma.shipment.findUnique({ where: { id }, select: { status: true, driverId: true } });
    if (!existing) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    const now = new Date();
    const updated = await prisma.shipment.update({ where: { id }, data: { status: parsed.data.status, startedAt: parsed.data.status === "IN_TRANSIT" ? (existing.status === "IN_TRANSIT" ? undefined : now) : undefined, deliveredAt: parsed.data.status === "DELIVERED" ? now : undefined }, include: { driver: { select: { id: true, name: true, username: true } }, locations: { orderBy: { recordedAt: "asc" }, take: 1000 }, stops: { orderBy: { createdAt: "asc" } } } });
    await logAudit({ userId: actor.id, action: "shipment.status.update", module: "envios", entityType: "shipment", entityId: id, beforeData: { status: existing.status }, afterData: { status: updated.status } });
    if (updated.status === "DELIVERED" || updated.status === "CANCELLED") await completeShipmentWorkTask(id, updated.status === "DELIVERED" ? "COMPLETED" : "CANCELLED", actor.id);
    return NextResponse.json({ shipment: serializeShipment(updated) });
  } catch (error) {
    console.error("[envios] No se pudo actualizar el estado", error);
    return NextResponse.json({ error: "No se pudo actualizar el estado." }, { status: 500 });
  }
}
