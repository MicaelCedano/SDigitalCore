"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CheckCheck,
  Clock,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  getQcPaymentsAction,
  approveRevisionBatchAction,
} from "../actions/revision-batch";
import { ConfirmBatchModal } from "./ConfirmBatchModal";

const RATE = 50; // RD$ por equipo revisado

const money = (value: number) => `RD$ ${value.toLocaleString("es-DO")}`;

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

interface QcPaymentsViewProps {
  initialData: any;
}

export function QcPaymentsView({ initialData }: QcPaymentsViewProps) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{
    batch: any;
    reject: boolean;
  } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    setRefreshing(true);
    const res = await getQcPaymentsAction();
    if (res.success && res.data) setData(res.data);
    setRefreshing(false);
  };

  const pending = (data?.pending || []).filter((b: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [b.batchNumber, b.supplierName, b.submittedBy]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(" ")
      .includes(term);
  });
  const history = data?.history || [];

  const totalPendingAmount = (data?.pending || []).reduce(
    (acc: number, b: any) => acc + (b.estimatedAmount || 0),
    0
  );

  const handleApprove = async (id: string, reject: boolean) => {
    const batch = pending.find((b: any) => b.id === id);
    if (!batch) return;
    // Abre el modal moderno de confirmación en lugar del confirm() genérico
    setConfirmTarget({ batch, reject });
  };

  const confirmApprove = async () => {
    if (!confirmTarget) return;
    const { batch, reject } = confirmTarget;

    setProcessingId(batch.id);
    const res = await approveRevisionBatchAction({ id: batch.id, reject });
    setProcessingId(null);
    setConfirmTarget(null);
    if (res.success) {
      showToast("success", res.message ?? "Lote procesado.");
      refresh();
    } else {
      showToast("error", res.error || "No se pudo procesar el lote.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600/10 text-emerald-600 rounded-xl border border-emerald-600/20 shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Pagos de Control de Calidad</h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Acepta los lotes enviados por el QC y se acredita el pago a los revisores automáticamente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lote o proveedor..."
              className="w-full sm:w-56 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Lotes por aceptar</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-violet-600">
              {pending.length}
            </span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
              <Send className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Total por pagar</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">
              {money(totalPendingAmount)}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Lotes pagados</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">
              {history.length}
            </span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <History className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Lotes por aceptar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-600" /> Lotes enviados por el QC
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Al aceptar un lote se acredita el pago a los revisores (RD$ {RATE} por equipo).
            </p>
          </div>
          {pending.length > 0 && (
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              {pending.length} pendiente{pending.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="p-14 text-center text-slate-500 space-y-2">
            <Inbox className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No hay lotes por aceptar</p>
            <p className="text-xs text-slate-500">
              Cuando el QC termine de revisar y envíe un lote, aparecerá aquí para que lo aceptes y se pague.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Lote (Compra)</th>
                  <th className="px-5 py-3.5">Proveedor</th>
                  <th className="px-5 py-3.5 text-center">Equipos</th>
                  <th className="px-5 py-3.5 text-center">Funcionales</th>
                  <th className="px-5 py-3.5 text-center">Defectuosos</th>
                  <th className="px-5 py-3.5">Enviado por</th>
                  <th className="px-5 py-3.5 text-right">Monto a pagar</th>
                  <th className="px-5 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-slate-800">{b.batchNumber}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Enviado: {formatDate(b.submittedAt)}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold">{b.supplierName || "—"}</td>
                    <td className="px-5 py-4 text-center font-bold">
                      {b.reviewedDevices}/{b.totalDevices}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        {b.functionalCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                        {b.nonFunctionalCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">{b.submittedBy || "QC"}</td>
                    <td className="px-5 py-4 text-right font-black text-emerald-700">
                      {money(b.estimatedAmount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApprove(b.id, false)}
                          disabled={processingId === b.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {processingId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5" />
                          )}
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(b.id, true)}
                          disabled={processingId === b.id}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg text-[11px] border border-amber-200 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Devolver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de pagos */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" /> Historial de lotes pagados
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Lotes aceptados — los pagos quedaron acreditados en la wallet de los revisores.
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Aún no hay lotes completados con pago acreditado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Lote (Compra)</th>
                  <th className="px-5 py-3.5">Proveedor</th>
                  <th className="px-5 py-3.5 text-center">Equipos</th>
                  <th className="px-5 py-3.5 text-center">Funcionales</th>
                  <th className="px-5 py-3.5 text-center">Defectuosos</th>
                  <th className="px-5 py-3.5">Completado</th>
                  <th className="px-5 py-3.5 text-right">Pago acreditado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                    <td className="px-5 py-3.5 font-semibold">{b.supplierName || "—"}</td>
                    <td className="px-5 py-3.5 text-center font-bold">{b.reviewedDevices}/{b.totalDevices}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        {b.functionalCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                        {b.nonFunctionalCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{formatDate(b.completedAt)}</td>
                    <td className="px-5 py-3.5 text-right font-black text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                        {money(b.estimatedAmount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación moderno (reemplaza confirm() nativo) */}
      <ConfirmBatchModal
        batch={confirmTarget?.batch ?? null}
        reject={confirmTarget?.reject ?? false}
        loading={processingId !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmApprove}
      />

      {/* Toast de resultado */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-2xl px-5 py-3.5 shadow-2xl border animate-in slide-in-from-bottom-4 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-700"
              : "bg-red-600 text-white border-red-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCheck className="w-4.5 h-4.5 shrink-0" />
          ) : (
            <XCircle className="w-4.5 h-4.5 shrink-0" />
          )}
          <span className="text-xs font-bold leading-snug">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
