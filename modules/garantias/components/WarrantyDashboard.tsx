"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Truck,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { listWarrantyCases } from "@/modules/garantias/actions/warranty";
import { WarrantyStatusBadge } from "@/modules/garantias/components/WarrantyStatusBadge";
import { WARRANTY_STATUS_LABELS } from "@/modules/garantias/lib/status-machine";
import { WarrantyQuickActions } from "@/modules/garantias/components/WarrantyQuickActions";
import { WarrantyCaseDetailDrawer } from "@/modules/garantias/components/WarrantyCaseDetailDrawer";
import type { WarrantyFlowCase, WarrantyFlowOperation } from "@/modules/garantias/components/WarrantyFlow";

type CaseRow = {
  id: string;
  caseCode: string;
  imei: string;
  model: string;
  clientName: string;
  problem: string;
  status: keyof typeof WARRANTY_STATUS_LABELS;
  entryDate: string | Date;
  archivedAt: string | Date | null;
};

type StatCard = {
  key: string;
  label: string;
  value: number;
  icon: typeof Inbox;
  tone: string;
};

const statusOptions = Object.entries(WARRANTY_STATUS_LABELS) as Array<[keyof typeof WARRANTY_STATUS_LABELS, string]>;

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Santo_Domingo" });
}

export function WarrantyDashboard({
  initialCases,
  total,
  page,
  pageSize,
  stats,
  quickCases,
  canCreate,
  canTransition,
}: {
  initialCases: CaseRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: Record<string, number>;
  quickCases: Partial<Record<WarrantyFlowOperation, WarrantyFlowCase[]>>;
  canCreate: boolean;
  canTransition: boolean;
}) {
  const [rows, setRows] = useState(initialCases);
  const [totalRows, setTotalRows] = useState(total);
  const [currentPage, setCurrentPage] = useState(page);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [olderThan30, setOlderThan30] = useState(false);
  const [archive, setArchive] = useState<"active" | "archived" | "all">("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const firstRender = useRef(true);
  const requestSequence = useRef(0);

  const cards = useMemo<StatCard[]>(() => [
    { key: "ALL", label: "Casos activos", value: stats.ACTIVE_TOTAL ?? total, icon: Inbox, tone: "indigo" },
    { key: "RECEIVED", label: "Recibidos", value: stats.RECEIVED ?? 0, icon: FileCheck2, tone: "blue" },
    { key: "IN_REPAIR", label: "En reparación", value: stats.IN_REPAIR ?? 0, icon: Wrench, tone: "amber" },
    { key: "RECEIVED_FROM_TECHNICIAN", label: "Del técnico", value: stats.RECEIVED_FROM_TECHNICIAN ?? 0, icon: UserRoundCheck, tone: "violet" },
    { key: "SENT_TO_SUPPLIER", label: "En suplidor", value: stats.SENT_TO_SUPPLIER ?? 0, icon: Truck, tone: "orange" },
    { key: "OPEN_30_PLUS", label: "Más de 30 días", value: stats.OPEN_30_PLUS ?? 0, icon: Clock3, tone: "rose" },
  ], [stats, total]);

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const hasFilters = Boolean(search.trim() || status !== "ALL" || olderThan30 || archive !== "active");

  useEffect(() => {
    const refresh = () => setRefreshVersion((version) => version + 1);
    window.addEventListener("warranty-data-changed", refresh);
    return () => window.removeEventListener("warranty-data-changed", refresh);
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const requestId = ++requestSequence.current;
      startTransition(() => {
        void (async () => {
          const result = await listWarrantyCases({ search, status: status as keyof typeof WARRANTY_STATUS_LABELS | "ALL", page: currentPage, pageSize, olderThan30, archive });
          if (result.success && requestId === requestSequence.current) {
            setRows(result.data.cases as unknown as CaseRow[]);
            setTotalRows(result.data.total);
          }
        })();
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [archive, currentPage, olderThan30, pageSize, refreshVersion, search, status]);

  function selectStatus(nextStatus: string) {
    setStatus(nextStatus);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setOlderThan30(false);
    setArchive("active");
    setCurrentPage(1);
  }

  return (
    <div className="warranty-dashboard mx-auto max-w-[1440px] space-y-6 pb-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><FileCheck2 size={22} /></span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#101828]">Gestión de Garantías</h1>
              <p className="mt-1 text-sm text-[#667085]">Controla cada caso desde el ingreso hasta la entrega.</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#98a2b3]"><CalendarDays size={14} /> Datos operativos actualizados al consultar.</p>
        </div>
        <WarrantyQuickActions cases={quickCases} canCreate={canCreate} canTransition={canTransition} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = card.key === "OPEN_30_PLUS" ? olderThan30 : status === card.key;
          return <button key={card.key} type="button" onClick={() => card.key === "OPEN_30_PLUS" ? (setOlderThan30(!olderThan30), setCurrentPage(1)) : selectStatus(card.key)} className={`enterprise-panel flex min-h-[108px] items-start justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-indigo-300 ring-2 ring-indigo-100" : ""}`}><span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone === "amber" ? "bg-amber-50 text-amber-600" : card.tone === "rose" ? "bg-rose-50 text-rose-600" : card.tone === "blue" ? "bg-blue-50 text-blue-600" : card.tone === "violet" ? "bg-violet-50 text-violet-600" : card.tone === "orange" ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-600"}`}><Icon size={18} /></span><span className="mt-3 block text-xs font-medium text-[#667085]">{card.label}</span><strong className="mt-1 block text-2xl font-bold text-[#101828]">{card.value}</strong></span><ArrowUpRight size={16} className="text-[#98a2b3]" /></button>;
        })}
      </section>

      <section className="space-y-5">
        <div className="enterprise-panel overflow-hidden">
          <div className="border-b border-[#e4e7ec] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-semibold text-[#101828]">Casos de garantía</h2><p className="mt-1 text-xs text-[#667085]">{totalRows} registros encontrados</p></div>
              <div className="flex gap-2"><button type="button" onClick={() => setFiltersOpen(!filtersOpen)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${filtersOpen || hasFilters ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-[#d0d5dd] text-[#475467] hover:bg-[#f8fafc]"}`}><SlidersHorizontal size={16} /> Filtros{hasFilters ? " activos" : ""}</button><button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d0d5dd] px-3 text-sm font-medium text-[#475467] disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={15} /> Limpiar</button></div>
            </div>
            <div className="relative mt-4"><Search size={17} className="absolute left-3 top-3 text-[#98a2b3]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Buscar por IMEI, modelo, cliente o código..." className="h-11 w-full rounded-xl border border-[#d0d5dd] pl-10 pr-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></div>
            {filtersOpen && <div className="mt-3 grid gap-3 border-t border-[#f0f1f3] pt-3 sm:grid-cols-3"><label className="text-xs font-semibold text-[#667085]">Estado<select value={status} onChange={(event) => selectStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm font-normal text-[#344054]"><option value="ALL">Todos los estados</option>{statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs font-semibold text-[#667085]">Archivo<select value={archive} onChange={(event) => { setArchive(event.target.value as typeof archive); setCurrentPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm font-normal text-[#344054]"><option value="active">Solo activos</option><option value="archived">Solo archivados</option><option value="all">Todos</option></select></label><label className="flex items-end gap-2 rounded-lg border border-[#e4e7ec] px-3 py-2.5 text-sm text-[#344054]"><input type="checkbox" checked={olderThan30} onChange={(event) => { setOlderThan30(event.target.checked); setCurrentPage(1); }} className="h-4 w-4 rounded border-[#d0d5dd] text-indigo-600" /> Casos con más de 30 días</label></div>}
          </div>
          <div className={`overflow-x-auto transition-opacity ${isPending ? "opacity-50" : ""}`}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.08em] text-[#667085]"><tr><th className="px-5 py-3 font-semibold">Caso</th><th className="px-5 py-3 font-semibold">Cliente</th><th className="px-5 py-3 font-semibold">Equipo</th><th className="px-5 py-3 font-semibold">Falla reportada</th><th className="px-5 py-3 font-semibold">Estado</th><th className="px-5 py-3 font-semibold">Ingreso</th></tr></thead>
              <tbody className="divide-y divide-[#f0f1f3]">
                {rows.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedCase(item)}
                    className={`group cursor-pointer transition hover:bg-[#f8fafc] ${item.archivedAt ? "bg-slate-50/70 opacity-75" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCase(item);
                        }}
                        className="font-mono text-xs font-bold text-indigo-600 hover:underline"
                      >
                        {item.caseCode}
                      </button>
                      <p className="mt-1 text-[11px] text-[#98a2b3]">
                        {item.archivedAt ? (
                          <><Archive size={11} className="inline" /> Archivado</>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCase(item);
                            }}
                            className="hover:text-indigo-600 hover:underline"
                          >
                            Ver detalle <ArrowUpRight size={12} className="inline" />
                          </button>
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-medium text-[#344054]">{item.clientName}</td>
                    <td className="px-5 py-4"><p className="font-medium text-[#344054]">{item.model}</p><p className="mt-1 font-mono text-[11px] text-[#667085]">IMEI {item.imei}</p></td>
                    <td className="max-w-[260px] px-5 py-4 text-[#667085]"><p className="truncate" title={item.problem}>{item.problem}</p></td>
                    <td className="px-5 py-4"><WarrantyStatusBadge status={item.status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#667085]">{formatDate(item.entryDate)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f4f7] text-[#667085]"><Search size={20} /></span><p className="mt-3 font-medium text-[#344054]">No encontramos casos</p><p className="mt-1 text-sm text-[#667085]">Prueba cambiando la búsqueda o los filtros.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#e4e7ec] px-5 py-3 text-xs text-[#667085] sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {rows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalRows)} de {totalRows}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1 || isPending} className="rounded-lg border border-[#d0d5dd] p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="min-w-16 text-center">Página {currentPage} / {pageCount}</span><button type="button" onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount || isPending} className="rounded-lg border border-[#d0d5dd] p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        </div>
      </section>

      <WarrantyCaseDetailDrawer
        item={selectedCase}
        onClose={() => setSelectedCase(null)}
      />
    </div>
  );
}
