"use client";

import Link from "next/link";
import {
  ScanSearch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Smartphone,
} from "lucide-react";

interface UserQcWidgetProps {
  data: {
    assignedPendingCount: number;
    inspectedTodayCount: number;
    assignedDevices: {
      id: string;
      imei: string | null;
      model: string;
      brand: string | null;
      status: string;
      createdAt: Date;
    }[];
    recentInspections: {
      id: string;
      deviceModel: string;
      imei: string | null;
      result: string | null;
      grade: string | null;
      batteryHealth: number | null;
      reviewedAt: Date | null;
    }[];
  };
}

function formatDate(value: Date | string | null) {
  if (!value) return "Sin fecha";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function UserQcWidget({ data }: UserQcWidgetProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-purple-500/10">
            <ScanSearch size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Control de Calidad (QC)</h3>
            <p className="text-xs text-slate-500">
              Inspecciones de equipos, checklists de entrada y lotes asignados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/qc"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-purple-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-purple-700 active:scale-[0.98]"
          >
            <ScanSearch size={14} /> Panel de Inspección
          </Link>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-600">Equipos Asignados Pendientes</span>
          <p className="mt-1 font-mono text-xl font-bold text-purple-700">{data.assignedPendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600">Inspecciones Hoy</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700">{data.inspectedTodayCount}</p>
        </div>
      </div>

      {/* Grid de 2 columnas: Equipos pendientes e Inspecciones recientes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna 1: Equipos Pendientes */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cola de Equipos por Revisar
            </h4>
            <Link href="/qc" className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.assignedDevices.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.assignedDevices.map((dev) => (
                  <div key={dev.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {dev.brand ? `${dev.brand} ` : ""}{dev.model}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">
                        IMEI: {dev.imei || "Sin IMEI"}
                      </p>
                    </div>
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-200/60">
                      PENDIENTE QC
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No tienes equipos pendientes de revisión.
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: Inspecciones Recientes */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Últimas Inspecciones
            </h4>
            <Link href="/qc/equipos-revisados" className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center gap-1">
              Historial <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.recentInspections.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.recentInspections.map((insp) => (
                  <div key={insp.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {insp.deviceModel}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Batería: {insp.batteryHealth ? `${insp.batteryHealth}%` : "N/A"} · Grado: {insp.grade || "N/A"} · {formatDate(insp.reviewedAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        insp.result === "PASSED"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60"
                      }`}
                    >
                      {insp.result === "PASSED" ? "APROBADO" : "RECHAZADO"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay inspecciones registradas recientemente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
