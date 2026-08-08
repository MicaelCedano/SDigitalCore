"use client";

import { exportSingleReceiptToExcel } from "@/lib/utils/excel-export";
import {
  FileSpreadsheet,
  X,
  MapPin,
  Barcode,
  Layers,
  Palette,
  Truck,
} from "lucide-react";

interface GoodsReceiptDetailModalProps {
  receipt: any;
  onClose: () => void;
}

export function GoodsReceiptDetailModal({
  receipt,
  onClose,
}: GoodsReceiptDetailModalProps) {
  if (!receipt) return null;

  const formattedDate = new Date(receipt.receivedAt || receipt.createdAt).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalQty = (receipt.items || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 1),
    0
  );

  const totalAmount = (receipt.items || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 1) * (item.unitPrice || 0),
    0
  );

  const handleExportExcel = () => {
    exportSingleReceiptToExcel({
      receiptNumber: receipt.receiptNumber,
      supplierName: receipt.supplierName,
      branch: receipt.branch,
      receivedBy: receipt.receivedBy,
      status: receipt.status,
      notes: receipt.notes,
      receivedAt: receipt.receivedAt || receipt.createdAt,
      items: receipt.items || [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  Recibo {receipt.receiptNumber}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 font-bold rounded-full border ${
                    receipt.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : receipt.status === "DRAFT"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {receipt.status === "COMPLETED"
                    ? "COMPLETADO"
                    : receipt.status === "DRAFT"
                    ? "BORRADOR"
                    : "CANCELADO"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Registrado el {formattedDate} por {receipt.receivedBy}
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
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Proveedor</span>
              <span className="text-sm font-bold text-slate-800 block truncate">
                {receipt.supplierName}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Sucursal / Almacén</span>
              <span className="text-sm font-bold text-slate-800 block truncate flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#5750f1] shrink-0" />
                {receipt.branch}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Total Modelos / Uds</span>
              <span className="text-sm font-bold text-[#5750f1] block">
                {receipt.items?.length || 0} modelos ({totalQty} uds)
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1 font-medium">Monto Estimado</span>
              <span className="text-sm font-bold text-emerald-600 block">
                {totalAmount > 0
                  ? `RD$ ${totalAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                  : "No especificado"}
              </span>
            </div>
          </div>

          {receipt.notes && (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs text-slate-700">
              <span className="font-bold text-slate-800 block mb-1">Observaciones Generales:</span>
              <p className="italic">{receipt.notes}</p>
            </div>
          )}

          {/* Table of Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#5750f1]" /> Detalle de Modelos y Colores Recibidos
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">SKU / Código</th>
                      <th className="px-3 py-2.5">Modelo / Variantes por Color</th>
                      <th className="px-3 py-2.5 text-center">Cant.</th>
                      <th className="px-3 py-2.5 text-center">Condición</th>
                      <th className="px-3 py-2.5 text-right">Precio Unit.</th>
                      <th className="px-3 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipt.items?.map((item: any, idx: number) => {
                      const qty = item.quantity || 1;
                      const price = item.unitPrice || 0;
                      const subtotal = qty * price;
                      const variants = Array.isArray(item.colorVariants) ? item.colorVariants : [];

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-3.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3.5 font-mono text-slate-600">
                            {item.code || "-"}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="font-bold text-slate-800 text-xs">{item.description}</div>
                            
                            {/* Render Variants breakdown */}
                            {variants.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {variants.map((v: any, vIdx: number) => {
                                  const vImeis = v.imeis
                                    ? v.imeis.split("\n").filter((s: string) => s.trim() !== "")
                                    : [];

                                  return (
                                    <div
                                      key={vIdx}
                                      className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-[11px] space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-semibold">
                                        <span className="text-[#5750f1] flex items-center gap-1">
                                          <Palette className="w-3 h-3 text-[#5750f1]" /> Color:{" "}
                                          <strong className="text-slate-800">{v.color || "General"}</strong>
                                        </span>
                                        <span className="text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                                          {v.quantity || 1} uds
                                        </span>
                                      </div>

                                      {vImeis.length > 0 && (
                                        <div className="pt-1">
                                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                            <Barcode className="w-3 h-3 text-emerald-600" /> IMEIs ({vImeis.length}):
                                          </span>
                                          <div className="flex flex-wrap gap-1 font-mono text-[10px] mt-0.5">
                                            {vImeis.map((imei: string, i: number) => (
                                              <span
                                                key={i}
                                                className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded"
                                              >
                                                {imei.trim()}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : item.imeiOrSerial ? (
                              <div className="mt-1.5 space-y-1">
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                  <Barcode className="w-3 h-3" /> IMEIs:
                                </span>
                                <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                  {item.imeiOrSerial.split("\n").map((imei: string, i: number) => (
                                    <span
                                      key={i}
                                      className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded"
                                    >
                                      {imei.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {item.notes && (
                              <div className="mt-1 text-[11px] text-slate-500 italic">
                                Nota: {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold text-[#5750f1]">{qty}</td>
                          <td className="px-3 py-3.5 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                              {item.condition || "Nuevo"}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            {price > 0
                              ? `RD$ ${price.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                              : "-"}
                          </td>
                          <td className="px-3 py-3.5 text-right font-semibold text-emerald-600">
                            {subtotal > 0
                              ? `RD$ ${subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                              : "-"}
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
