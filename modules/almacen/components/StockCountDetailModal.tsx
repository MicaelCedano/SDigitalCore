"use client";

import { exportStockCountToExcel } from "@/lib/utils/excel-export-stock-count";
import {
  FileSpreadsheet,
  X,
  MapPin,
  Barcode,
  Layers,
  ClipboardList,
} from "lucide-react";

interface StockCountDetailModalProps {
  count: any;
  onClose: () => void;
}

export function StockCountDetailModal({
  count,
  onClose,
}: StockCountDetailModalProps) {
  if (!count) return null;

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

  const handleExportExcel = () => {
    exportStockCountToExcel({
      countNumber: count.countNumber,
      title: count.title,
      branch: count.branch,
      performedBy: count.performedBy || "Auditor del Sistema",
      status: count.status,
      notes: count.notes,
      startedAt: count.startedAt || count.createdAt,
      items: count.items || [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
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

          {/* Table of Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#5750f1]" /> Resultado de Modelos Auditados
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
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
                      <th className="px-3 py-2.5">IMEIs Escaneados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {count.items?.map((item: any, idx: number) => {
                      const exp = item.expectedQty || 0;
                      const cnt = item.countedQty || 0;
                      const diff = cnt - exp;
                      const imeis = item.scannedImeis
                        ? item.scannedImeis.split("\n").filter((s: string) => s.trim() !== "")
                        : [];

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
                          <td className="px-3 py-3">
                            {imeis.length > 0 ? (
                              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                                {imeis.map((imei: string, i: number) => (
                                  <span
                                    key={i}
                                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded"
                                  >
                                    {imei.trim()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
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
    </div>
  );
}
