import type { Metadata } from "next";
import { InvoicesList } from "@/modules/facturas/components/InvoicesList";
import { getInvoicesAction } from "@/modules/facturas/actions/invoice";
import { formatInvoiceDate } from "@/modules/facturas/lib/display-date";

export const metadata: Metadata = {
  title: "Facturas & Conduces PDF | SDigitalCore",
  description: "Conduces de entrega, facturas y cálculo de cargadores desde un solo módulo",
};

export default async function FacturasPage() {
  // Load under the same authenticated render instead of a second client round trip.
  const initial = await getInvoicesAction();
  // Send the display label with the snapshot: Node and browser ICU can differ.
  const initialInvoices = initial.success
    ? initial.data.map(invoice => ({ ...invoice, displayCreatedAt: formatInvoiceDate(invoice.createdAt) }))
    : undefined;
  return <InvoicesList initialInvoices={initialInvoices} />;
}
