import Link from "next/link";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  ArrowRight,
  Calendar,
  Building2,
  UserCheck,
  Sparkles,
} from "lucide-react";

interface QcDashboardData {
  lotes: any[];
  stats: {
    lotesAsignados: number;
    pendientesTotal: number;
    revisadosHoy: number;
    aprobadosHoy: number;
    rechazadosHoy: number;
  };
  welcome: string;
}

export function QcDashboardView({ data }: { data: QcDashboardData | null }) {
  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p className="text-xs font-semibold">No se pudo cargar el panel de Control de Calidad.</p>
      </div>
    );
  }

  const { lotes, stats, welcome } = data;

  const statusLabel = (s: string) =>
    s === "COMPLETED"
      ? "COMPLETADO"
      : s === "IN_REVIEW"
      ? "EN REVISIÓN"
      : s === "PENDING_REVIEW"
      ? "PENDIENTE QC"
      : s === "CANCELLED"
      ? "CANCELADO"
      : s;

  const statusTone = (s: string) =>
    s === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "IN_REVIEW"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : s === "PENDING_REVIEW"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Panel de Control de Calidad</h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5750f1]" />
              {welcome}
            </p>
          </div>
        </div>
        <Link
          href="/qc/lotes"
          className="px-4 py-2.5 bg-slate-100 hover:bg-[#5750f1] hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
        >
          Ver todos mis lotes <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Lotes Asignados</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{stats.lotesAsignados}</span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Equipos por Revisar</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-600">{stats.pendientesTotal}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Revisados Hoy</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-blue-600">{stats.revisadosHoy}</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Resultado de Hoy</span>
          <div className="flex items-baseline justify-between mt-1 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-emerald-600">{stats.aprobadosHoy}</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">OK</span>
              <span className="text-2xl font-bold text-red-600">{stats.rechazadosHoy}</span>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">FALLA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mis lotes asignados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#5750f1]" /> Mis Lotes de Revisión
          </h2>
          <span className="text-[11px] font-bold text-slate-400">{lotes.length} asignado(s)</span>
        </div>

        {lotes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">No tienes lotes asignados</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              El administrador asigna los lotes de compra; cuando te asigne uno aparecerá aquí para que
              revises sus equipos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lotes.map((lote) => {
              const percent =
                lote.totalDevices > 0
                  ? Math.round(((lote.reviewedDevices || 0) / lote.totalDevices) * 100)
                  : 0;
              const fecha = new Date(lote.receivedAt || lote.createdAt).toLocaleDateString("es-DO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={lote.id}
                  href={`/qc/lotes/${lote.id}`}
                  className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 hover:border-[#5750f1]/40 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold text-[#5750f1] text-sm group-hover:underline">
                        {lote.batchNumber}
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> {lote.supplierName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {fecha}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full border shrink-0 ${statusTone(
                        lote.status
                      )}`}
                    >
                      {statusLabel(lote.status)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>
                        {lote.reviewedDevices || 0} / {lote.totalDevices} revisados
                        {lote.pendingDevices > 0 && (
                          <span className="text-amber-600"> · {lote.pendingDevices} por revisar</span>
                        )}
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="bg-[#5750f1] h-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600">
                      {lote.functionalCount || 0} OK
                      <span className="text-slate-300 mx-1">·</span>
                      <span className="text-red-600">{lote.nonFunctionalCount || 0} FALLA</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#5750f1] inline-flex items-center gap-1">
                      Revisar <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
