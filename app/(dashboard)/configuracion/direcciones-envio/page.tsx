import type { Metadata } from "next";
import { ShipmentAddressesManager } from "@/modules/configuracion/components/ShipmentAddressesManager";

export const metadata: Metadata = { title: "Direcciones de envío | SDigitalCore" };

export default function ShipmentAddressesPage() {
  return <ShipmentAddressesManager />;
}
