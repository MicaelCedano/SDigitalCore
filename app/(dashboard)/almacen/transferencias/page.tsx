import type { Metadata } from "next";
import { can, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { WarehouseRequestsManager } from "@/modules/almacen/components/WarehouseRequestsManager";

export const metadata: Metadata = {
  title: "Solicitudes de almacén | SDigitalCore",
  description: "Solicitudes de productos entre sucursales y almacén",
};

export default async function TransferenciasPage() {
  const user = await getPersistedCurrentUser();
  const canCreate = user && await can("warehouse.write");
  return (
    <WarehouseRequestsManager
      key={user?.id}
      roleCode={user?.roleCode ?? "VENTAS"}
      draftOwnerId={canCreate ? user?.id : undefined}
    />
  );
}
