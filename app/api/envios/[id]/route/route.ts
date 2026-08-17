import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { isLocationInDominicanRepublic } from "@/modules/envios/data";

const ORIGIN = { latitude: 18.4221107, longitude: -68.9676383, label: "Yacelltech" };
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

type GeocodeResult = { lat: string; lon: string; display_name: string };

async function geocodeDestination(address: string, mapsUrl: string | null) {
  if (mapsUrl) {
    try {
      const response = await fetch(mapsUrl, { redirect: "follow", cache: "no-store" });
      const match = response.url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (match) return { latitude: Number(match[1]), longitude: Number(match[2]), label: address };
    } catch { /* El enlace puede requerir una sesión de Google; usamos geocodificación por texto. */ }
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "do");
  url.searchParams.set("q", `${address}, República Dominicana`);
  const response = await fetch(url, { headers: { "User-Agent": "SDigitalCore/0.1.5 shipment routing" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("No se pudo localizar el destino.");
  const results = await response.json() as GeocodeResult[];
  const result = results[0];
  if (!result) throw new Error("No encontramos ese destino en República Dominicana. Agrega una dirección más específica.");
  return { latitude: Number(result.lat), longitude: Number(result.lon), label: result.display_name };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("envios.read");
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id }, include: { destinationAddress: { select: { address: true, mapsUrl: true } } } });
    if (!shipment) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    const destination = await geocodeDestination(shipment.destinationAddress?.address ?? shipment.destination, shipment.destinationAddress?.mapsUrl ?? null);
    if (!isLocationInDominicanRepublic(destination.latitude, destination.longitude)) return NextResponse.json({ error: "El destino debe estar dentro de República Dominicana." }, { status: 400 });

    const routeUrl = `${OSRM_URL}/${ORIGIN.longitude},${ORIGIN.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(routeUrl, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error("No se pudo calcular la ruta.");
    const data = await response.json() as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) throw new Error("No hay una ruta disponible para ese destino.");
    return NextResponse.json({ origin: ORIGIN, destination, distanceKm: Number((route.distance / 1000).toFixed(1)), durationMinutes: Math.max(1, Math.round(route.duration / 60)), coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]) });
  } catch (error) {
    console.error("[envios/route] No se pudo calcular la ruta", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo calcular la ruta." }, { status: 502 });
  }
}
