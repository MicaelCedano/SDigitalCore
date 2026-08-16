"use client";

import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Plus,
  Clock,
  ExternalLink,
  Wrench,
  Truck,
  CheckCircle2,
} from "lucide-react";
import type { WarrantyStatus } from "@prisma/client";
import { WARRANTY_STATUS_LABELS, WARRANTY_STATUS_TONES } from "@/modules/garantias/lib/status-machine";

interface UserWarrantyWidgetProps {
  data: {
    totalActive: number;
    inWorkshopCount: number;
    inSupplierCount: number;
    readyForDispatchCount: number;
    recentCases: {
      id: string;
      caseCode: string;
      imei: string;
      model: string;
      clientName: string;
      problem: string;
      status: WarrantyStatus;
      createdAt: Date;
    }[];
  };
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
  }).format(d);
}

export function UserWarrantyWidget({ data }: UserWarrantyWidgetProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Gestión de Garantías</h3>
            <p className="text-xs text-slate-500">
              Seguimiento de casos en taller, suplidores y listos para entrega
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/garantias/ingreso"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-700 active:scale-[0.98]"
          >
            <Plus size={14} /> Nueva Garantía
          </Link>
          <Link
            href="/garantias"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
          >
            Ver Casos <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Mini KPIs de Garantías */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400">Total Activas</span>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900">{data.totalActive}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-600">En Taller / Diagnóstico</span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-700">{data.inWorkshopCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-600">En Suplidor / RMA</span>
          <p className="mt-1 font-mono text-xl font-bold text-blue-700">{data.inSupplierCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600">Listas para Entrega</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700">{data.readyForDispatchCount}</p>
        </div>
      </div>

      {/* Casos recientes */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Casos Recientes de Garantía
          </h4>
          <Link
            href="/garantias"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
          >
            Ver panel completo <ArrowRight size={12} />
          </Link>
        </div>

        <div className="p-4">
          {data.recentCases.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recentCases.map((c) => {
                const label = WARRANTY_STATUS_LABELS[c.status] ?? c.status;
                const tone = WARRANTY_STATUS_TONES[c.status] ?? "bg-slate-100 text-slate-700";

                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between px-2 hover:bg-slate-50/50 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900">
                          {c.caseCode}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                          {label}
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {c.model}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        Cliente: <span className="font-medium text-slate-700">{c.clientName}</span> · Falla: {c.problem}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-slate-400">{formatDate(c.createdAt)}</span>
                      <Link
                        href={`/garantias/${c.caseCode}`}
                        className="focus-ring inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        Abrir <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay casos de garantías activos en este momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
