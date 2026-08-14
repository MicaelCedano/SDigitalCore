"use client";

import { useMemo, useState } from "react";
import { importGoodsReceiptToWarehouseAction } from "../actions/goods-receipt";
import type { GoodsReceiptWarehouseImportInput } from "@/lib/validation/goods-receipt";
import { AlertCircle, CheckCircle2, PackagePlus, X } from "lucide-react";

type ImportReceipt = {
  id: string;
  receiptNumber: string;
  items?: Array<{ id?: string; code?: string | null; description?: string | null; quantity?: number | null; colorVariants?: Array<{ color?: string | null; quantity?: number | null }> | null }>;
};
type ImportLine = GoodsReceiptWarehouseImportInput["lines"][number];

function buildLines(receipt: ImportReceipt): ImportLine[] {
  return (receipt.items || []).flatMap((item) => {
    const variants = item.colorVariants && item.colorVariants.length > 0 ? item.colorVariants : [{ color: "General", quantity: item.quantity || 1 }];
    return variants.map((variant) => ({ itemId: item.id || "", code: item.code || "", name: item.description?.trim() || "Modelo sin nombre", color: variant.color?.trim() || "General", quantity: Number(variant.quantity) || Number(item.quantity) || 1, unitsPerBox: 1 }));
  });
}

export function GoodsReceiptWarehouseImportModal({ receipt, onClose, onSuccess }: { receipt: ImportReceipt; onClose: () => void; onSuccess: () => void }) {
  const [lines, setLines] = useState<ImportLine[]>(() => buildLines(receipt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalUnits = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  const updateLine = (index: number, field: "code" | "unitsPerBox", value: string) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: field === "unitsPerBox" ? Math.max(1, Number(value) || 1) : value } : line));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const confirmed = window.confirm(`Confirmar envío del recibo ${receipt.receiptNumber} al almacén?\n\nSe enviarán ${totalUnits} unidades y el recibo quedará bloqueado para no enviarlo dos veces.`);
    if (!confirmed) return;
    setSaving(true);
    const result = await importGoodsReceiptToWarehouseAction({ receiptId: receipt.id, lines });
    setSaving(false);
    if (!result.success) { setError(result.error || "No se pudo importar el recibo."); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-xs sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <div><h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><PackagePlus className="h-5 w-5 text-[#5750f1]" /> Importar recibo a almacén</h2><p className="mt-1 text-xs text-slate-500">{receipt.receiptNumber} · {lines.length} modelo/color · {totalUnits} unidades recibidas</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-xs text-indigo-900">Completa el código Kaptas y las unidades que trae una caja. La cantidad recibida está bloqueada y se distribuirá automáticamente entre cajas y unidades sueltas.</div>
            {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <div className="space-y-3">{lines.map((line, index) => { const boxes = Math.floor(line.quantity / line.unitsPerBox); const looseUnits = line.quantity % line.unitsPerBox; return <div key={`${line.itemId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><div className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr] md:items-end"><div><p className="text-sm font-bold text-slate-800">{line.name}</p><p className="mt-1 text-xs font-semibold text-indigo-600">Color: {line.color}</p></div><label className="text-xs font-semibold text-slate-700">Código Kaptas<input required value={line.code} onChange={(event) => updateLine(index, "code", event.target.value)} placeholder="Ej. SAM-A16-AZ" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">Unidades por caja<input required type="number" min={1} value={line.unitsPerBox} onChange={(event) => updateLine(index, "unitsPerBox", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><div className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="block text-[10px] font-semibold uppercase text-slate-500">Recibido</span><strong className="text-slate-800">{line.quantity} uds</strong><span className="block text-[10px] text-slate-500">{boxes} cajas · {looseUnits} sueltas</span></div></div></div>; })}</div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5750f1] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 disabled:opacity-50">{saving ? "Importando..." : <><CheckCircle2 className="h-4 w-4" /> Crear productos y agregar cantidades</>}</button></div>
        </form>
      </div>
    </div>
  );
}
