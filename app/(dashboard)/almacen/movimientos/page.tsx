import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { WarehouseMovementsManager } from "@/modules/almacen/components/WarehouseMovementsManager";

export const metadata: Metadata = {
  title: "Movimientos de Almacén | SDigitalCore",
  description: "Registro de entradas y salidas de unidades de almacén",
};

export default async function MovimientosPage() {
  const user = await getCurrentUser();
  return <WarehouseMovementsManager roleCode={(user as { roleCode?: string } | null)?.roleCode ?? "ADMIN"} />;
}
