import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { listShipments, serializeShipment } from "@/modules/envios/data";
import { geocodeAddress } from "@/modules/envios/geocoding";
import { isLocationInDominicanRepublic } from "@/modules/envios/data";

const createShipmentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  destination: z.string().trim().min(3).max(300).optional(),
  destinationAddressId: z.string().trim().min(1).optional(),
  stopAddressIds: z.array(z.string().trim().min(1)).max(20).optional(),
  vehicleLabel: z.string().trim().max(120).optional(),
  driverId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional(),
});

function makeShipmentCode() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ENV-${stamp}-${suffix}`;
}

export async function GET() {
  try {
    return NextResponse.json({ shipments: await listShipments() });
  } catch (error) {
    console.error("[envios] No se pudieron listar los envíos", error);
    return NextResponse.json({ error: "No se pudieron cargar los envíos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("envios.write");
    const parsed = createShipmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos del envío inválidos." }, { status: 400 });

    const driver = await prisma.user.findFirst({ where: { id: parsed.data.driverId, status: "ACTIVE" }, select: { id: true } });
    if (!driver) return NextResponse.json({ error: "El conductor no está activo." }, { status: 400 });
    const addressIds = [...new Set([...(parsed.data.stopAddressIds ?? []), parsed.data.destinationAddressId].filter((value): value is string => Boolean(value)))];
    const selectedAddresses = addressIds.length > 0
      ? await prisma.shipmentAddress.findMany({ where: { id: { in: addressIds }, status: "ACTIVE", isDefaultOrigin: false }, select: { id: true, name: true, address: true, mapsUrl: true } })
      : [];
    if (addressIds.length > 0 && selectedAddresses.length !== addressIds.length) return NextResponse.json({ error: "Una de las direcciones seleccionadas no está activa." }, { status: 400 });

    const requestedStopIds = parsed.data.stopAddressIds?.length ? parsed.data.stopAddressIds : parsed.data.destinationAddressId ? [parsed.data.destinationAddressId] : [];
    const stopSources = selectedAddresses.length > 0
      ? selectedAddresses.filter((address) => requestedStopIds.includes(address.id))
      : parsed.data.destination ? [{ id: null, name: parsed.data.title, address: parsed.data.destination, mapsUrl: null }] : [];
    if (stopSources.length === 0) return NextResponse.json({ error: "Agrega al menos una parada o una dirección de destino." }, { status: 400 });
    const stops = await Promise.all(stopSources.map(async (stop) => {
      const point = await geocodeAddress(stop.address, stop.mapsUrl);
      if (!isLocationInDominicanRepublic(point.latitude, point.longitude)) throw new Error(`La parada "${stop.name}" debe estar dentro de República Dominicana.`);
      return { name: stop.name, address: stop.address, mapsUrl: stop.mapsUrl, latitude: point.latitude, longitude: point.longitude };
    }));
    const destination = parsed.data.destination ?? (stops.length === 1 ? stops[0].address : `Ruta de ${stops.length} paradas`);

    const shipment = await prisma.shipment.create({
      data: { title: parsed.data.title, destination, destinationAddressId: stops.length === 1 && selectedAddresses.length === 1 ? selectedAddresses[0].id : null, vehicleLabel: parsed.data.vehicleLabel, driverId: parsed.data.driverId, notes: parsed.data.notes, origin: "Origen GPS", originAddressId: null, code: makeShipmentCode(), createdById: actor.id, status: "READY", stops: { create: stops } },
      include: { driver: { select: { id: true, name: true, username: true } }, locations: true, stops: true },
    });
    await logAudit({ userId: actor.id, action: "shipment.create", module: "envios", entityType: "shipment", entityId: shipment.id, afterData: { code: shipment.code, title: shipment.title, driverId: shipment.driverId } });
    return NextResponse.json({ shipment: serializeShipment(shipment) }, { status: 201 });
  } catch (error) {
    console.error("[envios] No se pudo crear el envío", error);
    return NextResponse.json({ error: "No se pudo crear el envío." }, { status: 500 });
  }
}
