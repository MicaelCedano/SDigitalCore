import type { Metadata } from "next";
import { InvoicesList } from "@/modules/facturas/components/InvoicesList";
import { getInvoicesAction } from "@/modules/facturas/actions/invoice";

export const metadata: Metadata = {
  title: "Facturas & Conduces PDF | SDigitalCore",
  description: "Conduces de entrega, facturas y cálculo de cargadores desde un solo módulo",
};

export default async function FacturasPage() {
  // Load under the same authenticated render instead of a second client round trip.
  const initial = await getInvoicesAction();
  return <InvoicesList initialInvoices={initial.success ? initial.data : undefined} />;
}
