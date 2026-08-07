import type { Metadata } from "next";
import { WarehouseProductsManager } from "@/modules/almacen/components/WarehouseProductsManager";

export const metadata: Metadata = {
  title: "Almacén General | SDigitalCore",
  description: "Gestión de productos por cajas, unidades por caja e inventario de almacén",
};

export default function AlmacenPage() {
  return <WarehouseProductsManager />;
}
