"use client";

import Link from "next/link";
import {
  Wrench,
  Lock,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coins,
} from "lucide-react";

interface UserTechnicianWidgetProps {
  repairsData?: {
    pendingApprovalCount: number;
    completedCount: number;
    totalPendingAmount: number;
    recentJobs: {
      id: string;
      jobCode: string;
      totalEquipos: number;
      montoTotal: number;
      status: string;
      createdAt: Date;
    }[];
  };
  unlocksData?: {
    pendingCount: number;
    approvedCount: number;
    totalPendingAmount: number;
    recentRequests: {
      id: string;
      requestCode: string;
      model: string;
      totalEquipos: number;
      montoTotalPagado: number;
      status: string;
      createdAt: Date;
    }[];
  };
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function UserTechnicianWidget({ repairsData, unlocksData }: UserTechnicianWidgetProps) {
  const hasRepairs = !!repairsData;
  const hasUnlocks = !!unlocksData;

  const totalPendingAmount = (repairsData?.totalPendingAmount || 0) + (unlocksData?.totalPendingAmount || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-500/10">
            <Wrench size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Taller, Reparaciones y Desbloqueos</h3>
            <p className="text-xs text-slate-500">
              Cola de trabajo técnico, solicitudes enviadas y pagos generados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasRepairs && (
            <Link
              href="/reparaciones"
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-orange-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[0.98]"
            >
              <Wrench size={14} /> Panel Reparaciones
            </Link>
          )}
          {hasUnlocks && (
            <Link
              href="/desbloqueos"
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
            >
              <Lock size={14} /> Panel Desbloqueos
            </Link>
          )}
        </div>
      </div>

      {/* Mini KPIs de Técnico */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-600">Por Autorizar / Pagar</span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-700">
            RD$ {totalPendingAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </p>
        </div>
        {hasRepairs && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400">Reparaciones Completadas</span>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900">{repairsData.completedCount}</p>
          </div>
        )}
        {hasUnlocks && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400">Desbloqueos Aprobados</span>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900">{unlocksData.approvedCount}</p>
          </div>
        )}
      </div>

      {/* Grid de 2 columnas para Reparaciones y Desbloqueos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {hasRepairs && (
          <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-orange-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Mis Trabajos de Reparación
                </h4>
              </div>
              <Link
                href="/reparaciones"
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
              >
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>

            <div className="p-4 flex-1">
              {repairsData.recentJobs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {repairsData.recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                            {job.jobCode}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              job.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                            }`}
                          >
                            {job.status === "PAID" ? "PAGADO" : "PENDIENTE"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {job.totalEquipos} equipo(s) · {formatDate(job.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-xs font-bold text-slate-900">
                          RD$ {job.montoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tienes trabajos de reparación registrados.
                </div>
              )}
            </div>
          </div>
        )}

        {hasUnlocks && (
          <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Mis Solicitudes de Desbloqueo
                </h4>
              </div>
              <Link
                href="/desbloqueos"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                Ver todas <ArrowRight size={12} />
              </Link>
            </div>

            <div className="p-4 flex-1">
              {unlocksData.recentRequests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {unlocksData.recentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                            {req.requestCode}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              req.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                                : req.status === "REJECTED"
                                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60"
                                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                            }`}
                          >
                            {req.status === "APPROVED"
                              ? "APROBADO"
                              : req.status === "REJECTED"
                              ? "RECHAZADO"
                              : "PENDIENTE"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {req.model} · {req.totalEquipos} equipo(s) · {formatDate(req.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-xs font-bold text-slate-900">
                          RD$ {req.montoTotalPagado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tienes solicitudes de desbloqueo registradas.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
