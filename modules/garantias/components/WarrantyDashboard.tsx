"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, ShieldCheck } from "lucide-react";
import { WarrantyStatusBadge } from "@/modules/garantias/components/WarrantyStatusBadge";
import { WARRANTY_STATUS_LABELS } from "@/modules/garantias/lib/status-machine";

type CaseRow = {
  id: string;
  caseCode: string;
  imei: string;
  model: string;
  clientName: string;
  problem: string;
  status: keyof typeof WARRANTY_STATUS_LABELS;
  entryDate: string | Date;
};

export function WarrantyDashboard({
  initialCases,
  total,
  page,
  pageSize,
  stats,
}: {
  initialCases: CaseRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const filtered = useMemo(
    () =>
      initialCases.filter(
        (item) =>
          (!search ||
            [item.caseCode, item.imei, item.model, item.clientName]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (status === "ALL" || item.status === status),
      ),
    [initialCases, search, status],
  );
  const statuses = Object.keys(WARRANTY_STATUS_LABELS) as Array<keyof typeof WARRANTY_STATUS_LABELS>;

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldCheck size={23} />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#101828]">Gestión de Garantías</h1>
            <p className="mt-1 text-sm text-[#667085]">Casos, movimientos y documentos de recepción.</p>
          </div>
        </div>
        <Link href="/garantias/ingreso" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus size={17} /> Registrar ingreso
        </Link>
      </section>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {statuses.map((key) => (
          <button key={key} type="button" onClick={() => setStatus(key)} className={`enterprise-panel p-3 text-left transition ${status === key ? "border-indigo-300 ring-2 ring-indigo-100" : ""}`}>
            <p className="text-[11px] font-medium text-[#667085]">{WARRANTY_STATUS_LABELS[key]}</p>
            <p className="mt-1 text-2xl font-bold text-[#101828]">{stats[key] ?? 0}</p>
          </button>
        ))}
        <button type="button" onClick={() => setStatus("ALL")} className={`enterprise-panel p-3 text-left ${status === "ALL" ? "border-indigo-300 ring-2 ring-indigo-100" : ""}`}>
          <p className="text-[11px] font-medium text-[#667085]">Total activos</p>
          <p className="mt-1 text-2xl font-bold text-[#101828]">{total}</p>
        </button>
      </section>
      <section className="enterprise-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#e4e7ec] p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search size={17} className="absolute left-3 top-3 text-[#98a2b3]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por IMEI, modelo, cliente o código" className="h-10 w-full rounded-lg border border-[#d0d5dd] pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm">
            <option value="ALL">Todos los estados</option>
            {statuses.map((key) => <option key={key} value={key}>{WARRANTY_STATUS_LABELS[key]}</option>)}
          </select>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#667085]"><tr><th className="px-5 py-3">Caso</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Equipo</th><th className="px-5 py-3">Problema</th><th className="px-5 py-3">Estado</th></tr></thead>
            <tbody className="divide-y divide-[#f0f1f3]">
              {filtered.map((item) => <tr key={item.id} className="hover:bg-[#f8fafc]"><td className="px-5 py-4"><Link href={`/garantias/${item.caseCode}`} className="font-mono text-xs font-bold text-indigo-600 hover:underline">{item.caseCode}</Link><p className="mt-1 text-xs text-[#667085]">{new Date(item.entryDate).toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo" })}</p></td><td className="px-5 py-4 font-medium text-[#344054]">{item.clientName}</td><td className="px-5 py-4"><p className="font-medium text-[#344054]">{item.model}</p><p className="font-mono text-xs text-[#667085]">{item.imei}</p></td><td className="max-w-[260px] truncate px-5 py-4 text-[#667085]">{item.problem}</td><td className="px-5 py-4"><WarrantyStatusBadge status={item.status} /></td></tr>)}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#667085]">No hay casos que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-[#f0f1f3] md:hidden">{filtered.map((item) => <Link key={item.id} href={`/garantias/${item.caseCode}`} className="block p-4"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-bold text-indigo-600">{item.caseCode}</span><WarrantyStatusBadge status={item.status} /></div><p className="mt-2 font-semibold text-[#344054]">{item.clientName} · {item.model}</p><p className="mt-1 font-mono text-xs text-[#667085]">{item.imei}</p><p className="mt-2 line-clamp-2 text-xs text-[#667085]">{item.problem}</p></Link>)}</div>
        <div className="flex items-center justify-between border-t border-[#e4e7ec] px-5 py-3 text-xs text-[#667085]"><span>Página {page} · {total} casos</span><span className="flex gap-2"><button disabled={page <= 1} className="rounded border p-1 disabled:opacity-40"><ChevronLeft size={15} /></button><button disabled={page * pageSize >= total} className="rounded border p-1 disabled:opacity-40"><ChevronRight size={15} /></button></span></div>
      </section>
    </div>
  );
}
