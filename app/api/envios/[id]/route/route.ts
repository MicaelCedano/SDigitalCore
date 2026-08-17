import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { isLocationInDominicanRepublic } from "@/modules/envios/data";
import { geocodeAddress } from "@/modules/envios/geocoding";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const YACELLTECH = { latitude: 18.4221107, longitude: -68.9676383, label: "Yacelltech" };

type Point = { latitude: number; longitude: number; label: string };
type OsrmResponse = { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };

async function getDrivingRoute(start: Point, destination: Point) {
  const routeUrl = `${OSRM_URL}/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(routeUrl, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("No se pudo calcular la ruta.");
  const data = await response.json() as OsrmResponse;
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error("No hay una ruta disponible para ese destino.");
  return { destination, distanceKm: Number((route.distance / 1000).toFixed(1)), durationMinutes: Math.max(1, Math.round(route.duration / 60)), coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]) };
}

async function getLegacyDestination(address: string, mapsUrl: string | null) {
  const destination = await geocodeAddress(address, mapsUrl);
  if (!isLocationInDominicanRepublic(destination.latitude, destination.longitude)) throw new Error("El destino debe estar dentro de República Dominicana.");
  return destination;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("envios.read");
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id }, include: { destinationAddress: { select: { address: true, mapsUrl: true } }, locations: { orderBy: { recordedAt: "desc" }, take: 1 }, stops: { orderBy: { createdAt: "asc" } } } });
    if (!shipment) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    const current = shipment.locations[0] ? { latitude: Number(shipment.locations[0].latitude), longitude: Number(shipment.locations[0].longitude), label: "Ubicación actual" } : null;
    if (!current) return NextResponse.json({ error: "Activa el GPS del conductor para calcular la trayectoria." }, { status: 409 });

    if (shipment.stops.length > 0) {
      const pendingStops = shipment.stops.filter((stop) => stop.status === "PENDING");
      if (pendingStops.length === 0) {
        const returnRoute = await getDrivingRoute(current, YACELLTECH);
        return NextResponse.json({ origin: current, destination: returnRoute.destination, distanceKm: returnRoute.distanceKm, durationMinutes: returnRoute.durationMinutes, coordinates: returnRoute.coordinates, stops: [], returnToOrigin: true });
      }
      const segments = await Promise.all(pendingStops.map(async (stop) => {
        const segment = await getDrivingRoute(current, { latitude: Number(stop.latitude), longitude: Number(stop.longitude), label: stop.name });
        return { id: stop.id, name: stop.name, address: stop.address, status: stop.status, latitude: Number(stop.latitude), longitude: Number(stop.longitude), ...segment };
      }));
      const nearest = [...segments].sort((left, right) => left.durationMinutes - right.durationMinutes)[0];
      return NextResponse.json({ origin: current, destination: nearest.destination, distanceKm: nearest.distanceKm, durationMinutes: nearest.durationMinutes, coordinates: nearest.coordinates, stops: segments, returnToOrigin: false });
    }

    const destination = await getLegacyDestination(shipment.destinationAddress?.address ?? shipment.destination, shipment.destinationAddress?.mapsUrl ?? null);
    const route = await getDrivingRoute(current, destination);
    return NextResponse.json({ origin: current, destination, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, coordinates: route.coordinates, stops: [], returnToOrigin: false });
  } catch (error) {
    console.error("[envios/route] No se pudo calcular la ruta", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo calcular la ruta." }, { status: 502 });
  }
}
