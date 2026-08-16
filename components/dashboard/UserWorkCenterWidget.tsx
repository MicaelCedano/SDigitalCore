"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Flame,
  Layers,
} from "lucide-react";

interface UserWorkCenterWidgetProps {
  data: {
    totalPending: number;
    inProgressCount: number;
    urgentCount: number;
    completedWeekCount: number;
    myTasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      sourceModule: string;
      dueAt: Date | null;
      createdAt: Date;
      progressDone: number;
      progressTotal: number | null;
    }[];
  };
}

const moduleLabels: Record<string, string> = {
  qc: "QC",
  garantias: "Garantías",
  almacen: "Almacén",
  compras: "Compras",
  pagos: "Pagos",
  reparaciones: "Reparaciones",
  desbloqueos: "Desbloqueos",
  administracion: "Admin",
};

const priorityLabels: Record<string, { label: string; tone: string }> = {
  LOW: { label: "Baja", tone: "bg-slate-100 text-slate-700 ring-slate-200/60" },
  NORMAL: { label: "Normal", tone: "bg-blue-50 text-blue-700 ring-blue-200/60" },
  HIGH: { label: "Alta", tone: "bg-amber-50 text-amber-700 ring-amber-200/60" },
  URGENT: { label: "Urgente", tone: "bg-rose-50 text-rose-700 ring-rose-200/60" },
};

function formatDate(value: Date | string | null) {
  if (!value) return "Sin fecha límite";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
  }).format(d);
}

export function UserWorkCenterWidget({ data }: UserWorkCenterWidgetProps) {
  return (
    <div className="space-y-4">
      {/* Header del widget */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-500/10">
            <BriefcaseBusiness size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Mis Tareas y Actividad</h3>
            <p className="text-xs text-slate-500">
              Tareas asignadas a ti y seguimiento de flujo de trabajo operativo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/centro-trabajo"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700 active:scale-[0.98]"
          >
            <Plus size={14} /> Crear Tarea
          </Link>
          <Link
            href="/centro-trabajo"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
          >
            Ver Tablero Completo <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Mini KPIs de Tareas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400">Total Pendientes</span>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900">{data.totalPending}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-600">En Progreso</span>
          <p className="mt-1 font-mono text-xl font-bold text-blue-700">{data.inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-600">Urgentes / Altas</span>
          <p className="mt-1 font-mono text-xl font-bold text-rose-700">{data.urgentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600">Completadas Esta Semana</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700">{data.completedWeekCount}</p>
        </div>
      </div>

      {/* Lista de tareas */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="divide-y divide-slate-100">
          {data.myTasks.length > 0 ? (
            data.myTasks.map((task) => {
              const prio = priorityLabels[task.priority] ?? priorityLabels.NORMAL;
              const hasChecklist = typeof task.progressTotal === "number" && task.progressTotal > 0;
              const percent = hasChecklist ? Math.round((task.progressDone / task.progressTotal!) * 100) : 0;

              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        {moduleLabels[task.sourceModule] ?? task.sourceModule}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${prio.tone}`}>
                        {prio.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          task.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {task.status === "IN_PROGRESS" ? "EN PROGRESO" : "PENDIENTE"}
                      </span>
                    </div>

                    <h4 className="mt-1.5 text-xs font-bold text-slate-900 sm:text-sm">{task.title}</h4>

                    <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {formatDate(task.dueAt)}
                      </span>
                      {hasChecklist && (
                        <span>
                          Checklist: {task.progressDone}/{task.progressTotal} ({percent}%)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <Link
                      href="/centro-trabajo"
                      className="focus-ring inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                    >
                      Abrir tarea <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-xs text-slate-400">
              No tienes tareas pendientes ni en progreso en este momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
