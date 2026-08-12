"use client";

import { useState } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  Send,
  UserCheck,
  Sparkles,
  ScanSearch,
  ClipboardCheck,
  Loader2,
  Wallet,
  Coins,
} from "lucide-react";
import { getQcDashboardAction } from "../actions/revision-batch";
import { ReviewDeviceModal } from "./ReviewDeviceModal";
import { SolicitarImeisModal } from "./SolicitarImeisModal";

interface QcDashboardProps {
  initialData: any;
}

export function QcDashboardView({ initialData }: QcDashboardProps) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewDevice, setReviewDevice] = useState<any>(null);
  const [showSolicitar, setShowSolicitar] = useState(false);

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p className="text-xs font-semibold">No se pudo cargar el panel de Control de Calidad.</p>
      </div>
    );
  }

  const refresh = async () => {
    setRefreshing(true);
    const res = await getQcDashboardAction();
    if (res.success && res.data) setData(res.data);
    setRefreshing(false);
  };

  const { devices, myRequests, stats, welcome } = data;
  const requestCount = myRequests?.length || 0;

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
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowSolicitar(true)}
            className="px-4 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" /> Solicitar IMEIs
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Actualizar"
          >
            <Loader2 className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">IMEIs Asignados</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{stats.asignados}</span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Por Revisar</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-600">{stats.pendientes}</span>
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
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold text-emerald-600">{stats.aprobadosHoy}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">OK</span>
            <span className="text-2xl font-bold text-red-600">{stats.rechazadosHoy}</span>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">FALLA</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Ganado Hoy</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">
              RD$ {stats.ganadoHoy.toLocaleString("es-DO")}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Saldo del Wallet</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#5750f1]">
              RD$ {stats.saldoWallet.toLocaleString("es-DO")}
            </span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Mis solicitudes */}
      {requestCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-[#5750f1]" /> Mis Solicitudes de IMEIs
            </h2>
            <span className="text-[11px] font-bold text-slate-400">{requestCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {myRequests.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-[11px]"
              >
                <span className="font-mono font-bold text-slate-700">
                  {(Array.isArray(r.imeis) ? r.imeis.length : 0)} IMEIs
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    r.status === "ACCEPTED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : r.status === "REJECTED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {r.status === "ACCEPTED"
                    ? "ACEPTADA"
                    : r.status === "REJECTED"
                    ? "RECHAZADA"
                    : "PENDIENTE"}
                </span>
                <span className="text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mis IMEIs asignados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#5750f1]" /> Mis IMEIs Asignados
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {devices.length} IMEI(s) · {stats.revisados} revisados
          </span>
        </div>

        {devices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">No tienes IMEIs asignados</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Usa "Solicitar IMEIs" para pedir equipos que quieras revisar, o espera a que el
              administrador te asigne IMEIs. Aquí aparecerán los que queden a tu nombre.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">IMEI</th>
                    <th className="px-4 py-3.5">Modelo</th>
                    <th className="px-4 py-3.5">Lote (Compra)</th>
                    <th className="px-4 py-3.5 text-center">Estado</th>
                    <th className="px-4 py-3.5 text-center">Resultado QC</th>
                    <th className="px-4 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {devices.map((dev: any) => {
                    const last = dev.lastInspection;
                    const hasQC = last && last.status === "COMPLETED";
                    return (
                      <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 font-mono font-bold text-slate-800">
                          {dev.imei || dev.serialNumber || "—"}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {dev.brand} {dev.model}
                          {dev.storageGb ? ` ${dev.storageGb}GB` : ""}
                          {dev.color ? ` · ${dev.color}` : ""}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold font-mono">
                            {dev.batch?.batchNumber || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {dev.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {hasQC ? (
                            <span
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                                last.result === "FUNCTIONAL"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : last.result === "NON_FUNCTIONAL"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {last.result === "FUNCTIONAL"
                                ? "FUNCIONAL"
                                : last.result === "NON_FUNCTIONAL"
                                ? "DEFECTUOSO"
                                : "SIN CLASIFICAR"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              PENDIENTE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setReviewDevice(dev)}
                            className="px-2.5 py-1.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" /> Revisar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {reviewDevice && (
        <ReviewDeviceModal
          device={reviewDevice}
          onClose={() => setReviewDevice(null)}
          onSaved={() => {
            setReviewDevice(null);
            refresh();
          }}
        />
      )}
      {showSolicitar && (
        <SolicitarImeisModal
          onClose={() => setShowSolicitar(false)}
          onSent={() => {
            setShowSolicitar(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
