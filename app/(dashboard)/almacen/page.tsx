import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { WarehouseProductsManager } from "@/modules/almacen/components/WarehouseProductsManager";

export const metadata: Metadata = {
  title: "Almacén General | SDigitalCore",
  description: "Gestión de productos por cajas, unidades por caja e inventario de almacén",
};

export default async function AlmacenPage() {
  const user = await getCurrentUser();
  return <WarehouseProductsManager roleCode={(user as { roleCode?: string } | null)?.roleCode ?? "ADMIN"} />;
}
