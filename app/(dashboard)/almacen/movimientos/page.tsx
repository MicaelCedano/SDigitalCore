import type { Metadata } from "next";
import { WarehouseMovementsManager } from "@/modules/almacen/components/WarehouseMovementsManager";

export const metadata: Metadata = {
  title: "Movimientos de Almacén | SDigitalCore",
  description: "Registro de Entradas y Salidas de cajas y unidades de almacén",
};

export default function MovimientosPage() {
  return <WarehouseMovementsManager />;
}
