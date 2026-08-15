import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { BusinessPartnersManager } from "@/modules/configuracion/components/BusinessPartnersManager";

export const metadata: Metadata = { title: "Clientes y proveedores | SDigitalCore" };

export default async function BusinessPartnersPage() {
  await requirePermission("settings.read");
  const partners = await prisma.businessPartner.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true, taxId: true, contactName: true, phone: true, email: true, address: true, notes: true, status: true } });
  return <BusinessPartnersManager initialPartners={partners} />;
}
