"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Clock, Activity, FilePlus, ChevronRight, Smartphone, Sparkles } from "lucide-react";
import type { WarrantyStatus } from "@prisma/client";
import { WARRANTY_STATUS_LABELS, WARRANTY_STATUS_TONES, WARRANTY_EVENT_LABELS } from "@/modules/garantias/lib/status-machine";

export type RecentWarrantyCase = {
  id: string;
  caseCode: string;
  imei: string;
  model: string;
  clientName: string;
  problem: string;
  status: WarrantyStatus;
  entryDate: Date;
  createdAt: Date;
  assignedTechnicianName: string | null;
  currentSupplierName: string | null;
};

export type RecentWarrantyEvent = {
  id: string;
  type: string;
  fromStatus: WarrantyStatus | null;
  toStatus: WarrantyStatus | null;
  actorNameSnapshot: string | null;
  counterpartyName: string | null;
  reason: string | null;
  createdAt: Date;
  case: {
    id: string;
    caseCode: string;
    model: string;
    imei: string;
    clientName: string;
  };
};

interface AdminWarrantyWidgetProps {
  cases: RecentWarrantyCase[];
  events: RecentWarrantyEvent[];
  counts: Record<string, number>;
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function StatusBadge({ status }: { status: WarrantyStatus }) {
  const label = WARRANTY_STATUS_LABELS[status] ?? status;
  const tone = WARRANTY_STATUS_TONES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

export function AdminWarrantyWidget({ cases, events, counts }: AdminWarrantyWidgetProps) {
  const [activeTab, setActiveTab] = useState<"cases" | "events">("cases");

  const totalActive = counts.totalActive ?? 0;
  const inRepair = counts.IN_REPAIR ?? 0;
  const inSupplier = counts.SENT_TO_SUPPLIER ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Garantías y Trazabilidad</h3>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200/60">
                {totalActive} en curso
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Monitoreo de equipos en taller, suplidores y cambios de estado.
            </p>
          </div>
        </div>

        <Link
          href="/garantias/ingreso"
          className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
        >
          <FilePlus size={13} /> Nueva garantía
        </Link>
      </div>

      {/* Modern Status Strip */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-slate-500">Total Activas</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 sm:text-lg">{totalActive}</span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-amber-700">En Taller / Técnico</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-amber-800 sm:text-lg">{inRepair}</span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-rose-700">En Suplidor</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-rose-800 sm:text-lg">{inSupplier}</span>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="border-b border-slate-100 bg-slate-50/60 p-2 sm:px-6">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("cases")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "cases"
                ? "bg-white shadow-xs text-slate-900 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Clock size={13} className={activeTab === "cases" ? "text-indigo-600" : "text-slate-400"} />
            Últimas ingresadas
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "cases" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {cases.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "events"
                ? "bg-white shadow-xs text-slate-900 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Activity size={13} className={activeTab === "events" ? "text-indigo-600" : "text-slate-400"} />
            Movimientos recientes
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "events" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {events.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="divide-y divide-slate-100 p-2 sm:p-3">
        {activeTab === "cases" ? (
          cases.length > 0 ? (
            cases.map((c) => (
              <Link
                key={c.id}
                href={`/garantias/${c.caseCode}`}
                className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      {c.caseCode}
                    </span>
                    <StatusBadge status={c.status} />
                    <span className="text-[11px] text-slate-400">· {formatDate(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {c.model} <span className="font-mono text-xs font-normal text-slate-500">· IMEI: {c.imei}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Cliente: <span className="font-medium text-slate-800">{c.clientName}</span>
                    {c.assignedTechnicianName && (
                      <span> · Técnico: <span className="font-semibold text-indigo-600">{c.assignedTechnicianName}</span></span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 shrink-0 group-hover:text-indigo-800">
                  Ver detalle <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No hay garantías ingresadas recientemente.
            </div>
          )
        ) : events.length > 0 ? (
          events.map((evt) => {
            const eventTitle = WARRANTY_EVENT_LABELS[evt.type] ?? evt.type;
            return (
              <Link
                key={evt.id}
                href={`/garantias/${evt.case.caseCode}`}
                className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      {evt.case.caseCode}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {eventTitle}
                    </span>
                    {evt.fromStatus && evt.toStatus && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <StatusBadge status={evt.fromStatus} />
                        <span>→</span>
                        <StatusBadge status={evt.toStatus} />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {evt.case.model} <span className="font-normal text-slate-500">({evt.case.clientName})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {evt.actorNameSnapshot ? `Por: ${evt.actorNameSnapshot} · ` : ""}
                    {formatDate(evt.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 shrink-0 group-hover:text-indigo-800">
                  Ver garantía <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No se registraron movimientos de garantía recientemente.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-right sm:px-6 rounded-b-2xl">
        <Link href="/garantias" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
          Ir al módulo completo de garantías <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
