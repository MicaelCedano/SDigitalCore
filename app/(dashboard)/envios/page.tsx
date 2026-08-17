import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { listShipmentAddresses, listShipments } from "@/modules/envios/data";
import { ShipmentsManager } from "@/modules/envios/components/ShipmentsManager";

export const metadata: Metadata = { title: "Envíos y seguimiento | SDigitalCore" };

export default async function EnviosPage() {
  const user = await requirePermission("envios.read");
  const [shipments, drivers, addresses] = await Promise.all([
    listShipments(),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, username: true }, orderBy: { name: "asc" } }),
    listShipmentAddresses(),
  ]);
  return <ShipmentsManager initialShipments={shipments} drivers={drivers} addresses={addresses} currentUserId={user.id} />;
}
