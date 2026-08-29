"use client";

import { Loader2, X, CheckCheck, RotateCcw, Banknote, Package } from "lucide-react";

const money = (value: number) => `RD$ ${value.toLocaleString("es-DO")}`;

interface ConfirmBatchModalProps {
  batch: {
    id: string;
    batchNumber: string;
    portionId?: string | null;
    supplierName?: string | null;
    reviewedDevices: number;
    totalDevices: number;
    functionalCount: number;
    nonFunctionalCount: number;
    estimatedAmount: number;
  } | null;
  reject: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmBatchModal({ batch, reject, loading, onCancel, onConfirm }: ConfirmBatchModalProps) {
  if (!batch) return null;

  const title = reject ? "Devolver porción a revisión" : "Aceptar porción y acreditar pago";
  const description = reject
    ? "El lote volverá a EN REVISIÓN sin acreditar ningún pago. El equipo de control de calidad podrá seguir trabajando."
    : "Al aceptar el lote se acreditará el pago automáticamente a la wallet de los revisores que hicieron cada revisión.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-start justify-between">
          <div
            className={`p-3 rounded-2xl border shrink-0 ${
              reject
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-emerald-50 text-emerald-600 border-emerald-200"
            }`}
          >
            {reject ? <RotateCcw className="w-6 h-6" /> : <CheckCheck className="w-6 h-6" />}
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-3">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>

          {/* Detalle de la porción */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" /> Porción
              </span>
              <span className="font-mono font-black text-slate-800 text-sm">{batch.portionId || "Histórica"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lote</span>
              <span className="font-mono font-bold text-slate-700 text-xs">{batch.batchNumber}</span>
            </div>
            {batch.supplierName && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</span>
                <span className="text-xs font-bold text-slate-700">{batch.supplierName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revisados</span>
              <span className="text-xs font-bold text-slate-700">
                {batch.reviewedDevices}/{batch.totalDevices} equipos
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resultado</span>
              <span className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  {batch.functionalCount} OK
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                  {batch.nonFunctionalCount} FALLA
                </span>
              </span>
            </div>
            {!reject && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-dashed border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-slate-400" /> Pago a acreditar
                </span>
                <span className="text-base font-black text-emerald-600">{money(batch.estimatedAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 ${
              reject
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : reject ? (
              <RotateCcw className="w-4 h-4" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            {loading ? "Procesando..." : reject ? "Sí, devolver" : "Aceptar y acreditar"}
          </button>
        </div>
      </div>
    </div>
  );
}
