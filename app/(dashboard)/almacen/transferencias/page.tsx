import type { Metadata } from "next";
import { WarehouseRequestsManager } from "@/modules/almacen/components/WarehouseRequestsManager";

export const metadata: Metadata = {
  title: "Solicitudes & Transferencias de Almacén | SDigitalCore",
  description: "Solicitudes de productos entre sucursales y transferencias de almacén",
};

export default function TransferenciasPage() {
  return <WarehouseRequestsManager />;
}
