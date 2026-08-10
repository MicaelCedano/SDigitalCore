import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/helpers";
import { getWarrantyCase } from "@/modules/garantias/actions/warranty";
import { WarrantyStatusBadge } from "@/modules/garantias/components/WarrantyStatusBadge";
import { WarrantyArchiveButton } from "@/modules/garantias/components/WarrantyArchiveButton";
import { formatDateTimeRD } from "@/lib/utils/format";

export default async function WarrantyCasePage({ params }: { params: Promise<{ caseCode: string }> }) {
  await requirePermission("warranties.read");
  const { caseCode } = await params;
  const result = await getWarrantyCase(caseCode);
  if (!result.success) notFound();
  const item = result.data as any;
  const canArchive = await can("warranties.archive");

  return <div className="mx-auto max-w-[1000px] space-y-5"><Link href="/garantias" className="text-sm font-medium text-indigo-600">← Volver a garantías</Link><section className="enterprise-panel p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-sm font-bold text-indigo-600">{item.caseCode}</p><h1 className="mt-1 text-2xl font-bold text-[#101828]">{item.clientName}</h1><p className="mt-1 text-sm text-[#667085]">Ingresado {formatDateTimeRD(item.createdAt)}</p></div><div className="flex items-center gap-3"><WarrantyStatusBadge status={item.status} />{canArchive && <WarrantyArchiveButton caseCode={item.caseCode} />}</div></div><div className="mt-6 grid gap-5 border-t border-[#e4e7ec] pt-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-[#98a2b3]">Equipo</p><p className="mt-1 font-semibold text-[#344054]">{item.model}</p><p className="font-mono text-sm text-[#667085]">{item.imei}</p></div><div><p className="text-xs font-semibold uppercase text-[#98a2b3]">Problema reportado</p><p className="mt-1 text-sm text-[#344054]">{item.problem}</p></div></div></section><section className="enterprise-panel p-6"><h2 className="font-semibold text-[#101828]">Historial del caso</h2><div className="mt-5 space-y-4">{item.events.map((event: any) => <div key={event.id} className="relative border-l-2 border-indigo-100 pl-5"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white" /><p className="text-sm font-semibold text-[#344054]">{event.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#667085]">{formatDateTimeRD(event.createdAt)} · {event.actorNameSnapshot ?? "Sistema"}</p>{event.reason && <p className="mt-1 text-sm text-[#667085]">{event.reason}</p>}</div>)}</div></section><section className="enterprise-panel p-6"><h2 className="font-semibold text-[#101828]">Documentos relacionados</h2><div className="mt-4 flex flex-wrap gap-2">{item.documentItems.map((entry: any) => <Link key={entry.document.id} href={`/garantias/documentos/${entry.document.documentCode}`} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{entry.document.documentCode}</Link>)}{item.documentItems.length === 0 && <p className="text-sm text-[#667085]">Todavía no hay documentos.</p>}</div></section></div>;
}
