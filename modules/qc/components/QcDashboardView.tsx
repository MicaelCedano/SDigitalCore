"use client";

import { useMemo, useState } from "react";
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
  Search,
  CheckCheck,
} from "lucide-react";
import { getQcDashboardAction, submitRevisionBatchAction } from "../actions/revision-batch";
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleSubmitLote = async (lote: any) => {
    if (
      !confirm(
        `¿Enviar el Lote ${lote.batchNumber} para aprobación del administrador? ` +
          `El pago se acreditará cuando ${lote.supplierName ? "el admin lo acepte" : "lo acepte el administrador"}.`
      )
    )
      return;
    setRefreshing(true);
    const res = await submitRevisionBatchAction({ id: lote.id });
    setRefreshing(false);
    if (res.success) {
      alert(res.message ?? "Lote enviado.");
      refresh();
    } else {
      alert(res.error || "No se pudo enviar el lote.");
    }
  };

  const { devices, myRequests, stats, welcome } = data;
  const requestCount = myRequests?.length || 0;

  // Búsqueda local: IMEI, serial, marca/modelo, lote
  const filteredDevices = (devices || []).filter((dev: any) => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return true;
    const haystack = [
      dev.imei,
      dev.serialNumber,
      dev.brand,
      dev.model,
      dev.color,
      dev.batch?.batchNumber,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(" ");
    return haystack.includes(term);
  });

  // Agrupar por lote para mostrar el avance y el botón de envío
  const lotes = useMemo(() => {
    const map = new Map<string, any>();
    for (const dev of devices || []) {
      const b = dev.batch;
      if (!b) continue;
      const entry = map.get(b.id) || {
        id: b.id,
        batchNumber: b.batchNumber,
        supplierName: b.supplierName,
        status: b.status,
        totalDevices: b.totalDevices || 0,
        reviewedDevices: b.reviewedDevices || 0,
        myCount: 0,
        myReviewed: 0,
      };
      entry.myCount += 1;
      const vigente = (dev.lastInspection?.createdAt ?? new Date(0)) >= new Date(b.createdAt);
      if (dev.lastInspection?.status === "COMPLETED" && vigente) entry.myReviewed += 1;
      map.set(b.id, entry);
    }
    return [...map.values()].sort((a, b) => (a.status === "IN_REVIEW" ? -1 : 1) - (b.status === "IN_REVIEW" ? -1 : 1));
  }, [devices]);

  const canSubmitLote = (lote: any) =>
    lote.status === "IN_REVIEW" && lote.reviewedDevices >= lote.totalDevices && lote.totalDevices > 0;

  const statusLabel = (s: string) =>
    s === "COMPLETED"
      ? "COMPLETADO"
      : s === "SUBMITTED"
      ? "ENVIADO A APROBACIÓN"
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
      : s === "SUBMITTED"
      ? "bg-violet-50 text-violet-700 border-violet-200"
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

      {/* Mis lotes en revisión */}
      {lotes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#5750f1]" /> Mis lotes en revisión
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cuando un lote esté completo, envíalo al administrador para que acepte y acredite el pago.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {lotes.map((lote: any) => {
              const ready = canSubmitLote(lote);
              const enviado = lote.status === "SUBMITTED";
              return (
                <div key={lote.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 text-sm">{lote.batchNumber}</span>
                      {lote.supplierName && (
                        <span className="text-xs text-slate-500">· {lote.supplierName}</span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          enviado
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : ready
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : lote.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {enviado
                          ? "ENVIADO A APROBACIÓN"
                          : ready
                          ? "LISTO PARA ENVIAR"
                          : lote.status === "COMPLETED"
                          ? "COMPLETADO"
                          : "EN REVISIÓN"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 w-40 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#5750f1] transition-all"
                          style={{
                            width: `${lote.totalDevices > 0 ? Math.round((lote.reviewedDevices / lote.totalDevices) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">
                        {lote.reviewedDevices}/{lote.totalDevices} revisados
                      </span>
                      <span className="text-[11px] text-slate-400">
                        · tuyos: {lote.myReviewed}/{lote.myCount}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {enviado ? (
                      <span className="px-3 py-2 bg-violet-50 text-violet-700 font-bold text-xs rounded-xl border border-violet-200 inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Esperando aprobación
                      </span>
                    ) : ready ? (
                      <button
                        type="button"
                        onClick={() => handleSubmitLote(lote)}
                        disabled={refreshing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {refreshing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Enviar Lote
                      </button>
                    ) : (
                      <span className="px-3 py-2 bg-slate-50 text-slate-500 font-bold text-xs rounded-xl border border-slate-200 inline-flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5" /> Falta revisar equipos
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#5750f1]" /> Mis IMEIs Asignados
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar IMEI, modelo o lote..."
                className="w-56 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              />
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {filteredDevices.length} de {devices.length} IMEI(s) · {stats.revisados} revisados
            </span>
          </div>
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
                  {filteredDevices.map((dev: any) => {
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
                {filteredDevices.length === 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                        {searchQuery.trim() ? "No se encontraron equipos con ese criterio de búsqueda." : "Sin equipos asignados."}
                      </td>
                    </tr>
                  </tfoot>
                )}
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
