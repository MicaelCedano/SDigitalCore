import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { isLocationInDominicanRepublic } from "@/modules/envios/data";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10000).nullable().optional(),
  speedMps: z.number().min(0).max(100).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getPersistedCurrentUser();
    if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    const { id } = await context.params;
    const parsed = locationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !isLocationInDominicanRepublic(parsed.data.latitude, parsed.data.longitude)) return NextResponse.json({ error: "La ubicación debe estar dentro de República Dominicana." }, { status: 400 });

    const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, driverId: true, status: true } });
    if (!shipment) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    const canTrackAny = user.roleCode === "ADMIN";
    if (shipment.driverId !== user.id && !canTrackAny) return NextResponse.json({ error: "No tienes permiso para reportar este envío." }, { status: 403 });
    if (!["READY", "IN_TRANSIT", "PAUSED"].includes(shipment.status)) return NextResponse.json({ error: "El envío no acepta nuevas ubicaciones." }, { status: 409 });

    const recordedAt = parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date();
    const location = await prisma.$transaction(async (tx) => {
      const created = await tx.shipmentLocation.create({ data: { shipmentId: id, latitude: parsed.data.latitude, longitude: parsed.data.longitude, accuracyMeters: parsed.data.accuracyMeters ?? null, speedMps: parsed.data.speedMps ?? null, heading: parsed.data.heading ?? null, recordedAt } });
      await tx.shipment.update({ where: { id }, data: { status: shipment.status === "READY" ? "IN_TRANSIT" : undefined, startedAt: shipment.status === "READY" ? new Date() : undefined, lastLatitude: parsed.data.latitude, lastLongitude: parsed.data.longitude, lastAccuracyMeters: parsed.data.accuracyMeters ?? null, lastSpeedMps: parsed.data.speedMps ?? null, lastHeading: parsed.data.heading ?? null, lastLocationAt: recordedAt } });
      return created;
    });
    return NextResponse.json({ accepted: true, recordedAt: location.recordedAt.toISOString() });
  } catch (error) {
    console.error("[envios] No se pudo registrar ubicación", error);
    return NextResponse.json({ error: "No se pudo registrar la ubicación." }, { status: 500 });
  }
}
