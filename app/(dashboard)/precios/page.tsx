import type { Metadata } from "next";
import { PriceListManager } from "@/modules/precios/components/PriceListManager";

export const metadata: Metadata = {
  title: "Lista de Precios SDigital | SDigitalCore",
  description: "Gestión oficial de lista de precios de celulares, mayoristas, detallistas y márgenes comerciales",
};

export default function PreciosPage() {
  return <PriceListManager />;
}
