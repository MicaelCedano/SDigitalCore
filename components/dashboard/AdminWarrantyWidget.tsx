"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Clock, Activity, FilePlus, ChevronRight } from "lucide-react";
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
  const tone = WARRANTY_STATUS_TONES[status] ?? "bg-gray-100 text-gray-700";
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
    <div className="enterprise-panel overflow-hidden">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[#101828]">Garantías y Movimientos</h3>
            <p className="mt-0.5 text-xs text-[#667085]">Últimas garantías ingresadas y actividad reciente.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/garantias/ingreso"
            className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[#4f46e5] px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#4338ca]"
          >
            <FilePlus size={14} /> Nueva garantía
          </Link>
        </div>
      </div>

      {/* Summary stats strip */}
      <div className="grid grid-cols-3 divide-x divide-[#f0f1f3] border-b border-[#e4e7ec] bg-[#fcfcfd]">
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-medium text-[#667085]">Activas</span>
          <span className="mt-0.5 block text-lg font-bold text-[#101828]">{totalActive}</span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-medium text-[#667085]">En reparación</span>
          <span className="mt-0.5 block text-lg font-bold text-[#b45309]">{inRepair}</span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-medium text-[#667085]">En suplidor</span>
          <span className="mt-0.5 block text-lg font-bold text-[#c2410c]">{inSupplier}</span>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-[#e4e7ec] bg-[#f8fafc] px-5 sm:px-6">
        <button
          type="button"
          onClick={() => setActiveTab("cases")}
          className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "cases"
              ? "border-[#4f46e5] text-[#4f46e5]"
              : "border-transparent text-[#667085] hover:text-[#344054]"
          }`}
        >
          <Clock size={14} />
          Últimas ingresadas
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === "cases" ? "bg-[#eef2ff] text-[#4338ca]" : "bg-gray-200 text-gray-700"
            }`}
          >
            {cases.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "events"
              ? "border-[#4f46e5] text-[#4f46e5]"
              : "border-transparent text-[#667085] hover:text-[#344054]"
          }`}
        >
          <Activity size={14} />
          Movimientos recientes
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === "events" ? "bg-[#eef2ff] text-[#4338ca]" : "bg-gray-200 text-gray-700"
            }`}
          >
            {events.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "cases" ? (
        cases.length > 0 ? (
          <div className="divide-y divide-[#f0f1f3]">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/garantias/${c.caseCode}`}
                className="group grid gap-2 px-5 py-3.5 transition-colors hover:bg-[#f8fafc] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#4f46e5]">{c.caseCode}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[#101828]">
                    {c.model} <span className="font-normal text-[#667085]">· IMEI: {c.imei}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    Cliente: <span className="font-medium text-[#344054]">{c.clientName}</span> · Ingresado: {formatDate(c.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-[#4338ca] shrink-0">
                  Ver detalle <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-[#667085]">
            No hay garantías ingresadas recientemente.
          </div>
        )
      ) : events.length > 0 ? (
        <div className="divide-y divide-[#f0f1f3]">
          {events.map((evt) => {
            const eventTitle = WARRANTY_EVENT_LABELS[evt.type] ?? evt.type;
            return (
              <Link
                key={evt.id}
                href={`/garantias/${evt.case.caseCode}`}
                className="group grid gap-2 px-5 py-3.5 transition-colors hover:bg-[#f8fafc] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#4f46e5]">{evt.case.caseCode}</span>
                    <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#334155]">
                      {eventTitle}
                    </span>
                    {evt.fromStatus && evt.toStatus && (
                      <div className="flex items-center gap-1 text-[11px] text-[#667085]">
                        <StatusBadge status={evt.fromStatus} />
                        <span>→</span>
                        <StatusBadge status={evt.toStatus} />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[#101828]">
                    {evt.case.model} <span className="font-normal text-[#667085]">({evt.case.clientName})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {evt.actorNameSnapshot ? `Por: ${evt.actorNameSnapshot} · ` : ""}
                    {formatDate(evt.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-[#4338ca] shrink-0">
                  Ver garantía <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-10 text-center text-sm text-[#667085]">
          No se registraron movimientos de garantía recientemente.
        </div>
      )}

      {/* Footer link */}
      <div className="border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 text-right sm:px-6">
        <Link href="/garantias" className="inline-flex items-center gap-1 text-xs font-semibold text-[#4338ca] hover:text-[#3730a3]">
          Ir al módulo completo de garantías <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
