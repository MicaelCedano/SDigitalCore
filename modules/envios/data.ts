import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import type { Shipment as ShipmentDto } from "@/modules/envios/types";

export const DOMINICAN_REPUBLIC_BOUNDS = {
  south: 17.35,
  north: 20.1,
  west: -72.2,
  east: -68.2,
};

export function isLocationInDominicanRepublic(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= DOMINICAN_REPUBLIC_BOUNDS.south
    && latitude <= DOMINICAN_REPUBLIC_BOUNDS.north
    && longitude >= DOMINICAN_REPUBLIC_BOUNDS.west
    && longitude <= DOMINICAN_REPUBLIC_BOUNDS.east;
}

type ShipmentForSerialization = {
  id: string; code: string; title: string; origin: string; destination: string; vehicleLabel: string | null; notes: string | null; status: string; startedAt: Date | null; deliveredAt: Date | null; lastLatitude: Prisma.Decimal | null; lastLongitude: Prisma.Decimal | null; lastAccuracyMeters: Prisma.Decimal | null; lastSpeedMps: Prisma.Decimal | null; lastHeading: Prisma.Decimal | null; lastLocationAt: Date | null;
  driver: { id: string; name: string | null; username: string | null } | null;
  locations: { latitude: Prisma.Decimal; longitude: Prisma.Decimal; accuracyMeters: Prisma.Decimal | null; speedMps: Prisma.Decimal | null; heading: Prisma.Decimal | null; recordedAt: Date }[];
  stops: { id: string; name: string; address: string; mapsUrl: string | null; latitude: Prisma.Decimal; longitude: Prisma.Decimal; status: string; arrivedAt: Date | null }[];
};

export function serializeShipment(shipment: ShipmentForSerialization): ShipmentDto {
  return {
    id: shipment.id,
    code: shipment.code,
    title: shipment.title,
    origin: shipment.origin,
    destination: shipment.destination,
    vehicleLabel: shipment.vehicleLabel,
    notes: shipment.notes,
    status: shipment.status as ShipmentDto["status"],
    driver: shipment.driver ? { id: shipment.driver.id, name: shipment.driver.name, username: shipment.driver.username } : null,
    startedAt: shipment.startedAt?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    lastLocation: shipment.lastLatitude !== null && shipment.lastLongitude !== null && shipment.lastLocationAt
      ? { latitude: Number(shipment.lastLatitude), longitude: Number(shipment.lastLongitude), accuracyMeters: shipment.lastAccuracyMeters ? Number(shipment.lastAccuracyMeters) : null, speedMps: shipment.lastSpeedMps ? Number(shipment.lastSpeedMps) : null, heading: shipment.lastHeading ? Number(shipment.lastHeading) : null, recordedAt: shipment.lastLocationAt.toISOString() }
      : null,
    locations: shipment.locations.map((location) => ({ latitude: Number(location.latitude), longitude: Number(location.longitude), accuracyMeters: location.accuracyMeters ? Number(location.accuracyMeters) : null, speedMps: location.speedMps ? Number(location.speedMps) : null, heading: location.heading ? Number(location.heading) : null, recordedAt: location.recordedAt.toISOString() })),
    stops: shipment.stops.map((stop) => ({ id: stop.id, name: stop.name, address: stop.address, mapsUrl: stop.mapsUrl, latitude: Number(stop.latitude), longitude: Number(stop.longitude), status: stop.status as "PENDING" | "ARRIVED", arrivedAt: stop.arrivedAt?.toISOString() ?? null })),
  };
}

export async function listShipments() {
  await requirePermission("envios.read");
  const shipments = await prisma.shipment.findMany({
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      driver: { select: { id: true, name: true, username: true } },
      locations: { orderBy: { recordedAt: "asc" }, take: 1000 },
      stops: { orderBy: { createdAt: "asc" } },
    },
  });
  return shipments.map(serializeShipment);
}

export async function listShipmentAddresses() {
  await requirePermission("envios.read");
  return prisma.shipmentAddress.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ isDefaultOrigin: "desc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, mapsUrl: true, isDefaultOrigin: true },
  });
}
