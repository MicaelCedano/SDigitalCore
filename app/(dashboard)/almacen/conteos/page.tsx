import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Conteos de Stock | SDigitalCore",
  description: "Auditoría física de inventario de celulares, escáner rápido de IMEIs y comparación esperado vs. contado",
};

export default function ConteosPage() {
  redirect("/almacen");
}
