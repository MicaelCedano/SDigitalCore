"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { shipmentAddressSchema, type ShipmentAddressInput } from "@/lib/validation/shipment-address";

export async function getShipmentAddressesAction(activeOnly = false) {
  try {
    await requireUser();
    const addresses = await prisma.shipmentAddress.findMany({
      where: activeOnly ? { status: "ACTIVE" } : undefined,
      orderBy: [{ isDefaultOrigin: "desc" }, { name: "asc" }],
    });
    return { success: true as const, data: addresses };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudieron obtener las direcciones.", data: [] };
  }
}

export async function saveShipmentAddressAction(input: ShipmentAddressInput) {
  try {
    const actor = await requirePermission("settings.write");
    const data = shipmentAddressSchema.parse(input);
    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefaultOrigin) {
        await tx.shipmentAddress.updateMany({ where: { isDefaultOrigin: true, ...(data.id ? { id: { not: data.id } } : {}) }, data: { isDefaultOrigin: false } });
      }
      return data.id
        ? tx.shipmentAddress.update({ where: { id: data.id }, data: { name: data.name, address: data.address, mapsUrl: data.mapsUrl || null, isDefaultOrigin: data.isDefaultOrigin, status: data.status } })
        : tx.shipmentAddress.create({ data: { name: data.name, address: data.address, mapsUrl: data.mapsUrl || null, isDefaultOrigin: data.isDefaultOrigin, status: data.status } });
    });
    await logAudit({ userId: actor.id, action: data.id ? "shipment_address.update" : "shipment_address.create", module: "configuracion", entityType: "shipment_address", entityId: address.id, afterData: { name: address.name, isDefaultOrigin: address.isDefaultOrigin, status: address.status } });
    revalidatePath("/configuracion/direcciones-envio");
    revalidatePath("/envios");
    return { success: true as const, data: address };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo guardar la dirección." };
  }
}

export async function deactivateShipmentAddressAction(id: string) {
  try {
    const actor = await requirePermission("settings.write");
    const address = await prisma.shipmentAddress.update({ where: { id }, data: { status: "INACTIVE", isDefaultOrigin: false } });
    await logAudit({ userId: actor.id, action: "shipment_address.deactivate", module: "configuracion", entityType: "shipment_address", entityId: id, afterData: { name: address.name, status: address.status } });
    revalidatePath("/configuracion/direcciones-envio");
    revalidatePath("/envios");
    return { success: true as const, data: address };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo desactivar la dirección." };
  }
}
