import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { sendPushToRole } from "@/lib/mobile/push";
import { isLocationInDominicanRepublic } from "@/modules/envios/data";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10000).nullable().optional(),
  speedMps: z.number().min(0).max(100).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  recordedAt: z.string().datetime().optional(),
});

const ARRIVAL_RADIUS_METERS = 120;
const YACELLTECH = { latitude: 18.4221107, longitude: -68.9676383 };

function distanceInMeters(latitude: number, longitude: number, destination: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = toRadians(destination.latitude - latitude);
  const deltaLongitude = toRadians(destination.longitude - longitude);
  const originLatitude = toRadians(latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getPersistedCurrentUser();
    if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    const { id } = await context.params;
    const parsed = locationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !isLocationInDominicanRepublic(parsed.data.latitude, parsed.data.longitude)) return NextResponse.json({ error: "La ubicación debe estar dentro de República Dominicana." }, { status: 400 });

    const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, code: true, title: true, driverId: true, status: true, stops: { select: { id: true, name: true, latitude: true, longitude: true, status: true } } } });
    if (!shipment) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    const canTrackAny = user.roleCode === "ADMIN";
    if (shipment.driverId !== user.id && !canTrackAny) return NextResponse.json({ error: "No tienes permiso para reportar este envío." }, { status: 403 });
    if (!["READY", "IN_TRANSIT", "PAUSED"].includes(shipment.status)) return NextResponse.json({ error: "El envío no acepta nuevas ubicaciones." }, { status: 409 });

    const recordedAt = parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date();
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.shipmentLocation.create({ data: { shipmentId: id, latitude: parsed.data.latitude, longitude: parsed.data.longitude, accuracyMeters: parsed.data.accuracyMeters ?? null, speedMps: parsed.data.speedMps ?? null, heading: parsed.data.heading ?? null, recordedAt } });
      const arrivedStopIds = shipment.stops.filter((stop) => stop.status === "PENDING" && distanceInMeters(parsed.data.latitude, parsed.data.longitude, { latitude: Number(stop.latitude), longitude: Number(stop.longitude) }) <= ARRIVAL_RADIUS_METERS).map((stop) => stop.id);
      const arrivedStopsUpdate = arrivedStopIds.length > 0
        ? await tx.shipmentStop.updateMany({ where: { id: { in: arrivedStopIds }, status: "PENDING" }, data: { status: "ARRIVED", arrivedAt: recordedAt } })
        : { count: 0 };
      const allStopsArrived = shipment.stops.length > 0 && shipment.stops.every((stop) => stop.status === "ARRIVED" || arrivedStopIds.includes(stop.id));
      const completedAtYacelltech = allStopsArrived && distanceInMeters(parsed.data.latitude, parsed.data.longitude, YACELLTECH) <= ARRIVAL_RADIUS_METERS;
      await tx.shipment.update({ where: { id }, data: { status: completedAtYacelltech ? "DELIVERED" : shipment.status === "READY" ? "IN_TRANSIT" : undefined, startedAt: shipment.status === "READY" ? new Date() : undefined, deliveredAt: completedAtYacelltech ? recordedAt : undefined, lastLatitude: parsed.data.latitude, lastLongitude: parsed.data.longitude, lastAccuracyMeters: parsed.data.accuracyMeters ?? null, lastSpeedMps: parsed.data.speedMps ?? null, lastHeading: parsed.data.heading ?? null, lastLocationAt: recordedAt } });
      return { created, delivered: completedAtYacelltech, arrivedStopNames: arrivedStopsUpdate.count > 0 ? shipment.stops.filter((stop) => arrivedStopIds.includes(stop.id)).map((stop) => stop.name) : [] };
    });
    if (result.arrivedStopNames.length > 0) {
      await sendPushToRole("ADMIN", {
        title: "Parada alcanzada",
        body: `${shipment.title} (${shipment.code}) llegó a ${result.arrivedStopNames.join(", ")}.`,
        route: "/envios",
        type: "shipment.stop_arrived",
      });
    }
    if (result.delivered) {
      await sendPushToRole("ADMIN", {
        title: "Envío completado",
        body: `${shipment.title} (${shipment.code}) regresó a Yacelltech. El GPS se apagó.`,
        route: "/envios",
        type: "shipment.delivered",
      });
    }
    return NextResponse.json({ accepted: true, delivered: result.delivered, recordedAt: result.created.recordedAt.toISOString() });
  } catch (error) {
    console.error("[envios] No se pudo registrar ubicación", error);
    return NextResponse.json({ error: "No se pudo registrar la ubicación." }, { status: 500 });
  }
}
