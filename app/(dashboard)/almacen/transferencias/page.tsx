import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { WarehouseRequestsManager } from "@/modules/almacen/components/WarehouseRequestsManager";

export const metadata: Metadata = {
  title: "Solicitudes de almacén | SDigitalCore",
  description: "Solicitudes de productos entre sucursales y almacén",
};

export default async function TransferenciasPage() {
  const user = await getCurrentUser();
  const persistedUser = user?.id
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { roleCode: true } })
    : null;
  return <WarehouseRequestsManager roleCode={persistedUser?.roleCode ?? "VENTAS"} />;
}
