import type { Metadata } from "next";
import { GoodsReceiptsList } from "@/modules/almacen/components/GoodsReceiptsList";

export const metadata: Metadata = {
  title: "Recibos de Mercancía | SDigitalCore",
  description: "Registro de mercancía entrante, control de proveedores, IMEIs y exportación a Excel",
};

export default function GoodsReceiptsPage() {
  return <GoodsReceiptsList />;
}
