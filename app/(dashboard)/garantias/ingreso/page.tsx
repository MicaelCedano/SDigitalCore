import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/helpers";
import { WarrantyIntakeForm } from "@/modules/garantias/components/WarrantyIntakeForm";
export const metadata: Metadata = { title: "Registrar ingreso de garantía" };
export default async function WarrantyIntakePage() { await requirePermission("warranties.create"); return <div className="mx-auto max-w-[1000px] space-y-5"><Link href="/garantias" className="text-sm font-medium text-indigo-600">← Volver a garantías</Link><div><h1 className="text-2xl font-bold text-[#101828]">Registrar ingreso</h1><p className="mt-1 text-sm text-[#667085]">Crea uno o varios casos para el mismo cliente y genera el recibo.</p></div><WarrantyIntakeForm/></div>; }
