import type { Metadata } from "next";
import { StockCountsList } from "@/modules/almacen/components/StockCountsList";

export const metadata: Metadata = {
  title: "Conteos de Stock | SDigitalCore",
  description: "Auditoría física de inventario de celulares, escáner rápido de IMEIs y comparación esperado vs. contado",
};

export default function ConteosPage() {
  return <StockCountsList />;
}
