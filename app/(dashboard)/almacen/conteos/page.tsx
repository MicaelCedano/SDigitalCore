import type { Metadata } from "next";
import { StockCountsList } from "@/modules/almacen/components/StockCountsList";

export const metadata: Metadata = {
  title: "Auditorías de Stock | SDigitalCore",
  description: "Auditoría física de inventario de almacén, verificación de existencias y comparación de esperado vs. contado",
};

export default function ConteosPage() {
  return <StockCountsList />;
}

