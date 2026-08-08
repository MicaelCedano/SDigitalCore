import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { WarehouseRequestsManager } from "@/modules/almacen/components/WarehouseRequestsManager";

export const metadata: Metadata = {
  title: "Solicitudes & Transferencias de Almacén | SDigitalCore",
  description: "Solicitudes de productos entre sucursales y transferencias de almacén",
};

export default async function TransferenciasPage() {
  const user = await getCurrentUser();
  return <WarehouseRequestsManager roleCode={(user as { roleCode?: string } | null)?.roleCode ?? "ADMIN"} />;
}
