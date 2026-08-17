import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { listShipments, serializeShipment } from "@/modules/envios/data";

const createShipmentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  destination: z.string().trim().min(3).max(300),
  destinationAddressId: z.string().trim().min(1).optional(),
  vehicleLabel: z.string().trim().max(120).optional(),
  driverId: z.string().trim().min(1).optional(),
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

    if (parsed.data.driverId) {
      const driver = await prisma.user.findFirst({ where: { id: parsed.data.driverId, status: "ACTIVE" }, select: { id: true } });
      if (!driver) return NextResponse.json({ error: "El conductor no está activo." }, { status: 400 });
    }
    const defaultOrigin = await prisma.shipmentAddress.findFirst({ where: { status: "ACTIVE", isDefaultOrigin: true }, select: { id: true, address: true } });
    if (!defaultOrigin) return NextResponse.json({ error: "Configura primero una dirección de origen predeterminada." }, { status: 400 });
    const addressIds = [parsed.data.destinationAddressId].filter((value): value is string => Boolean(value));
    if (addressIds.length > 0) {
      const addresses = await prisma.shipmentAddress.findMany({ where: { id: { in: addressIds }, status: "ACTIVE" }, select: { id: true } });
      if (addresses.length !== new Set(addressIds).size) return NextResponse.json({ error: "Una de las direcciones seleccionadas no está activa." }, { status: 400 });
    }

    const shipment = await prisma.shipment.create({
      data: { ...parsed.data, origin: defaultOrigin.address, originAddressId: defaultOrigin.id, code: makeShipmentCode(), createdById: actor.id, status: "READY" },
      include: { driver: { select: { id: true, name: true, username: true } }, locations: true },
    });
    await logAudit({ userId: actor.id, action: "shipment.create", module: "envios", entityType: "shipment", entityId: shipment.id, afterData: { code: shipment.code, title: shipment.title, driverId: shipment.driverId } });
    return NextResponse.json({ shipment: serializeShipment(shipment) }, { status: 201 });
  } catch (error) {
    console.error("[envios] No se pudo crear el envío", error);
    return NextResponse.json({ error: "No se pudo crear el envío." }, { status: 500 });
  }
}
