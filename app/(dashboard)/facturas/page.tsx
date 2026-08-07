import type { Metadata } from "next";
import { InvoicesList } from "@/modules/facturas/components/InvoicesList";

export const metadata: Metadata = {
  title: "Facturas & Conduces PDF | SDigitalCore",
  description: "Conduces de entrega, facturas y cálculo de cargadores desde un solo módulo",
};

export default function FacturasPage() {
  return <InvoicesList />;
}
