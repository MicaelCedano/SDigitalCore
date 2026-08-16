"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Plus,
  ExternalLink,
  Flame,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";

export type AdminWorkTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  sourceModule: string;
  sourceCode: string | null;
  sourceUrl: string | null;
  dueAt: Date | string | null;
  createdAt: Date | string;
  progressDone: number;
  progressTotal: number | null;
  assignees: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }[];
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

export type AdminWorkCenterUserItem = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  currentTaskTitle: string | null;
  currentTaskModule: string | null;
  currentTaskCode: string | null;
  activeCount: number;
};

export type AdminWorkCenterData = {
  totalActive: number;
  inProgressCount: number;
  pendingCount: number;
  overdueCount: number;
  urgentCount: number;
  completedWeekCount: number;
  inProgressTasks: AdminWorkTaskItem[];
  pendingTasks: AdminWorkTaskItem[];
  teamMembers: AdminWorkCenterUserItem[];
};

interface AdminWorkCenterWidgetProps {
  data: AdminWorkCenterData;
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

function PriorityBadge({ priority }: { priority: string }) {
  const conf = priorityLabels[priority] ?? {
    label: priority,
    tone: "bg-slate-100 text-slate-700 ring-slate-200/60",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${conf.tone}`}
    >
      {conf.label}
    </span>
  );
}

export function AdminWorkCenterWidget({ data }: AdminWorkCenterWidgetProps) {
  const [activeTab, setActiveTab] = useState<"in_progress" | "pending" | "team">("in_progress");

  const {
    totalActive,
    inProgressCount,
    pendingCount,
    overdueCount,
    completedWeekCount,
    inProgressTasks,
    pendingTasks,
    teamMembers,
  } = data;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-500/10">
            <BriefcaseBusiness size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Centro de Trabajo</h3>
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200/60">
                {totalActive} en curso
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Tareas operativas, asignaciones en vivo y productividad del equipo.
            </p>
          </div>
        </div>

        <Link
          href="/centro-trabajo"
          className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
        >
          <Plus size={13} /> Ver bandeja completa
        </Link>
      </div>

      {/* Modern Status Strip */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-violet-700">En Proceso</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-violet-900 sm:text-lg">
            {inProgressCount}
          </span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-slate-600">Por Iniciar</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-slate-800 sm:text-lg">
            {pendingCount}
          </span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-rose-700">Atrasadas</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-rose-800 sm:text-lg">
            {overdueCount}
          </span>
        </div>
        <div className="p-3 text-center sm:px-4">
          <span className="block text-[11px] font-semibold text-emerald-700">Completadas</span>
          <span className="mt-0.5 block font-mono text-base font-bold text-emerald-800 sm:text-lg">
            {completedWeekCount}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100 bg-slate-50/60 p-2 sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("in_progress")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "in_progress"
                ? "bg-white shadow-xs text-slate-900 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Clock size={13} className={activeTab === "in_progress" ? "text-violet-600" : "text-slate-400"} />
            En proceso
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "in_progress" ? "bg-violet-50 text-violet-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {inProgressTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "pending"
                ? "bg-white shadow-xs text-slate-900 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Flame size={13} className={activeTab === "pending" ? "text-amber-600" : "text-slate-400"} />
            Pendientes / Urgentes
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {pendingTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "team"
                ? "bg-white shadow-xs text-slate-900 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Users size={13} className={activeTab === "team" ? "text-indigo-600" : "text-slate-400"} />
            Equipo ({teamMembers.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="divide-y divide-slate-100 p-2 sm:p-3">
        {activeTab === "in_progress" ? (
          inProgressTasks.length > 0 ? (
            inProgressTasks.map((task) => {
              const people = task.assignees.length
                ? task.assignees.map((a) => a.user)
                : task.assignee
                  ? [task.assignee]
                  : [];
              const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();

              return (
                <Link
                  key={task.id}
                  href="/centro-trabajo"
                  className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                        {moduleLabels[task.sourceModule] ?? task.sourceModule}
                      </span>
                      {task.sourceCode && (
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                          {task.sourceCode}
                        </span>
                      )}
                      <PriorityBadge priority={task.priority} />
                      {isOverdue && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200/60">
                          Atrasada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {people.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="flex -space-x-1.5">
                            {people.slice(0, 3).map((p) => (
                              <UserAvatar
                                key={p.id}
                                name={p.name}
                                email={p.email}
                                src={p.image}
                                className="h-5 w-5 border border-white"
                                textClassName="text-[8px]"
                              />
                            ))}
                          </span>
                          <span>{people.map((p) => p.name ?? p.email).join(", ")}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sin responsable asignado</span>
                      )}
                      <span>· Límite: {formatDate(task.dueAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-violet-600 shrink-0 group-hover:text-violet-800">
                    Ver tarea <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="px-6 py-9 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                <CheckCircle2 size={20} />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900">No hay tareas en proceso actualmente</p>
              <p className="mt-0.5 text-xs text-slate-500">
                El equipo ha completado sus actividades en curso o está disponible para nuevas tareas.
              </p>
            </div>
          )
        ) : activeTab === "pending" ? (
          pendingTasks.length > 0 ? (
            pendingTasks.map((task) => {
              const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
              return (
                <Link
                  key={task.id}
                  href="/centro-trabajo"
                  className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                        {moduleLabels[task.sourceModule] ?? task.sourceModule}
                      </span>
                      {task.sourceCode && (
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                          {task.sourceCode}
                        </span>
                      )}
                      <PriorityBadge priority={task.priority} />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {task.status === "IN_REVIEW" ? "En revisión" : "Pendiente"}
                      </span>
                      {isOverdue && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200/60">
                          Atrasada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{task.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Fecha límite: <span className="font-medium text-slate-700">{formatDate(task.dueAt)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 shrink-0 group-hover:text-indigo-800">
                    Abrir en centro <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="px-6 py-9 text-center text-sm text-slate-500">
              No hay tareas pendientes en cola de espera.
            </div>
          )
        ) : teamMembers.length > 0 ? (
          <div className="grid gap-2.5 p-2 sm:grid-cols-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    name={member.name}
                    email={member.email}
                    src={member.image}
                    className="h-9 w-9"
                    textClassName="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{member.name || member.email}</p>
                    {member.currentTaskTitle ? (
                      <p className="truncate text-[11px] font-medium text-violet-700">
                        {member.currentTaskTitle}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-400">Disponible</p>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    member.currentTaskTitle
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {member.currentTaskTitle ? "En proceso" : "Libre"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-9 text-center text-sm text-slate-500">
            No hay personal asignado actualmente.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-right sm:px-6 rounded-b-2xl">
        <Link
          href="/centro-trabajo"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Ir a Centro de trabajo y asignaciones <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
