import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { WarehouseMovementsManager } from "@/modules/almacen/components/WarehouseMovementsManager";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Movimientos de Almacén | SDigitalCore",
  description: "Registro de entradas y salidas de unidades de almacén",
};

export default async function MovimientosPage() {
  const user = await getCurrentUser();
  const persistedUser = user
    ? await prisma.user.findFirst({
        where: user.id ? { id: user.id } : { email: user.email ?? "" },
        select: { roleCode: true },
      })
    : null;

  if (persistedUser?.roleCode !== "ADMIN") {
    redirect("/almacen/transferencias");
  }

  return <WarehouseMovementsManager roleCode="ADMIN" />;
}
