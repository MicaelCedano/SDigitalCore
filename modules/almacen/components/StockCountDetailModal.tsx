"use client";

import { useState, useMemo } from "react";
import { exportStockCountToExcel } from "@/lib/utils/excel-export-stock-count";
import { applyStockCountToWarehouseAction } from "../actions/stock-count";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  FileSpreadsheet,
  X,
  MapPin,
  Barcode,
  Layers,
  ClipboardList,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface StockCountDetailModalProps {
  count: any;
  onClose: () => void;
  roleCode?: string;
  onReconciled?: () => void;
}

export function StockCountDetailModal({
  count,
  onClose,
  roleCode = "USER",
  onReconciled,
}: StockCountDetailModalProps) {
  const [applying, setApplying] = useState(false);
  const [showConfirmApply, setShowConfirmApply] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  if (!count) return null;

  const sortedItems = useMemo(() => {
    return [...(count.items || [])].sort((a: any, b: any) =>
      (a.description || "").localeCompare(b.description || "", "es", { sensitivity: "base" })
    );
  }, [count.items]);

  const formattedDate = new Date(count.startedAt || count.createdAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalExpected = (count.items || []).reduce(
    (sum: number, item: any) => sum + (item.expectedQty || 0),
    0
  );

  const totalCounted = (count.items || []).reduce(
    (sum: number, item: any) => sum + (item.countedQty || 0),
    0
  );

  const totalDiff = totalCounted - totalExpected;

  const handleApplyToWarehouse = async () => {
    try {
      setApplying(true);
      setReconcileMessage(null);
      setReconcileError(null);
      const res = await applyStockCountToWarehouseAction(count.id);
      if (res.success) {
        setReconcileMessage(res.message || "Almacén ajustado exitosamente al conteo físico.");
        if (onReconciled) onReconciled();
      } else {
        setReconcileError(res.error || "No se pudo ajustar el almacén");
      }
    } catch (err: any) {
      setReconcileError(err.message || "Error al procesar el ajuste");
    } finally {
      setApplying(false);
      setShowConfirmApply(false);
    }
  };

  const handleExportExcel = () => {
    exportStockCountToExcel({
      countNumber: count.countNumber,
      title: count.title,
      branch: count.branch,
      performedBy: count.performedBy || "Auditor del Sistema",
      status: count.status,
      notes: count.notes,
      startedAt: count.startedAt || count.createdAt,
      items: sortedItems,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white border-0 sm:border sm:border-slate-200 text-slate-800 rounded-none sm:rounded-2xl w-full h-full sm:h-auto sm:max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-full sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  {count.countNumber} — {count.title}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 font-bold rounded-full border ${
                    count.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : count.status === "IN_PROGRESS"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {count.status === "COMPLETED"
                    ? "COMPLETADO"
                    : count.status === "IN_PROGRESS"
                    ? "EN PROCESO"
                    : "CANCELADO"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Auditoría iniciada el {formattedDate} por {count.performedBy}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roleCode === "ADMIN" && count.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={handleApplyToWarehouse}
                disabled={applying}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                title="Ajustar inventario de Almacén para que coincida exactamente con este conteo físico"
              >
                <SlidersHorizontal className={`w-4 h-4 ${applying ? "animate-spin" : ""}`} />
                <span>{applying ? "Ajustando..." : "Sincronizar Físico con Almacén"}</span>
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Sucursal Auditada</span>
              <span className="text-sm font-bold text-slate-800 block truncate flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#5750f1] shrink-0" />
                {count.branch}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Esperado (Sistema)</span>
              <span className="text-sm font-bold text-slate-800 block">
                {totalExpected} uds
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Contado (Físico)</span>
              <span className="text-sm font-extrabold text-[#5750f1] block">
                {totalCounted} uds
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Diferencia Total</span>
              <span
                className={`text-sm font-extrabold block ${
                  totalDiff === 0
                    ? "text-emerald-600"
                    : totalDiff > 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {totalDiff === 0 ? "0 (OK)" : totalDiff > 0 ? `+${totalDiff} (Sobrante)` : `${totalDiff} (Faltante)`}
              </span>
            </div>
          </div>

          {count.notes && (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs text-slate-700">
              <span className="font-bold text-slate-800 block mb-1">Observaciones:</span>
              <p className="italic">{count.notes}</p>
            </div>
          )}

          {/* Banner de Sincronización para Administradores */}
          {roleCode === "ADMIN" && totalDiff !== 0 && !reconcileMessage && count.status !== "CANCELLED" && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  Hay una discrepancia de <strong>{totalDiff > 0 ? `+${totalDiff}` : totalDiff} unidades</strong> entre el sistema y el conteo físico. Puedes pulsar <strong>"Sincronizar Físico con Almacén"</strong> para que el Almacén tome los valores contados.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmApply(true)}
                disabled={applying}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 transition-colors shadow-2xs text-xs cursor-pointer"
              >
                {applying ? "Ajustando..." : "Ajustar Almacén Ahora"}
              </button>
            </div>
          )}

          {reconcileMessage && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{reconcileMessage}</span>
            </div>
          )}

          {reconcileError && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-center gap-2 text-xs text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{reconcileError}</span>
            </div>
          )}

          {/* Table of Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#5750f1]" /> Resultado de Modelos Auditados
            </h3>

            {/* Mobile Cards View */}
            <div className="block sm:hidden space-y-2">
              {sortedItems.map((item: any, idx: number) => {
                const exp = item.expectedQty || 0;
                const cnt = item.countedQty || 0;
                const diff = cnt - exp;

                return (
                  <div key={item.id || idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">{item.description}</h4>
                        {item.code && (
                          <span className="font-mono text-[10px] text-slate-500 block mt-0.5">{item.code}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border shrink-0 ${
                          diff === 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : diff > 0
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {diff === 0 ? "OK (0)" : diff > 0 ? `+${diff}` : diff}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px]">Sistema: <strong className="text-slate-700">{exp}</strong> uds</span>
                      <span className="text-slate-500 text-[11px]">Físico: <strong className="text-[#5750f1]">{cnt}</strong> uds</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">SKU / Código</th>
                      <th className="px-3 py-2.5">Modelo / Descripción</th>
                      <th className="px-3 py-2.5 text-center">Esperado</th>
                      <th className="px-3 py-2.5 text-center">Contado</th>
                      <th className="px-3 py-2.5 text-center">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedItems.map((item: any, idx: number) => {
                      const exp = item.expectedQty || 0;
                      const cnt = item.countedQty || 0;
                      const diff = cnt - exp;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-600">
                            {item.code || "-"}
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-800">
                            {item.description}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-600 font-semibold">{exp}</td>
                          <td className="px-3 py-3 text-center font-extrabold text-[#5750f1]">{cnt}</td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${
                                diff === 0
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : diff > 0
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {diff === 0 ? "0" : diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Descargar Excel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmApply}
        onClose={() => setShowConfirmApply(false)}
        onConfirm={handleApplyToWarehouse}
        title="Sincronizar Físico con Almacén"
        description={`¿Estás seguro de ajustar el inventario de Almacén con este conteo físico (${count.countNumber})?`}
        confirmText="Sí, ajustar almacén"
        cancelText="Cancelar"
        variant="primary"
        isLoading={applying}
      >
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2 mt-2">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Acción exclusiva de Administrador:
          </div>
          <ul className="space-y-1.5 text-slate-700 pl-1">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Las existencias de cada producto en Almacén pasarán a ser <strong>exactamente iguales a lo contado físicamente</strong>.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Se generarán los movimientos de ajuste (<strong>Entrada</strong> o <strong>Salida</strong>) en la bitácora de almacén.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Esta auditoría quedará cuadrada (<strong>diferencias = 0</strong>).</span>
            </li>
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  );
}
