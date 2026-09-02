"use client";

import { useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { updateFinalizedGoodsReceiptIdentityAction } from "../actions/goods-receipt";

type ReceiptItem = {
  id: string;
  description?: string | null;
  colorVariants?: Array<{ brand?: string | null; model?: string | null; capacity?: string | null }> | null;
};

type Receipt = { id: string; receiptNumber: string; items?: ReceiptItem[] | null };

export function GoodsReceiptIdentityEditModal({ receipt, onSuccess, onClose }: { receipt: Receipt; onSuccess: () => void; onClose: () => void }) {
  const [items, setItems] = useState(() => (receipt.items || []).map((item) => {
    const variant = item.colorVariants?.[0];
    return { itemId: item.id, model: variant?.model || item.description || "", brand: variant?.brand || "", capacity: variant?.capacity || "" };
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (index: number, field: "model" | "brand" | "capacity", value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  async function handleSave() {
    setError(null);
    if (items.some((item) => !item.model.trim())) {
      setError("Cada línea debe tener un modelo.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateFinalizedGoodsReceiptIdentityAction({ receiptId: receipt.id, items });
      if (!result.success) { setError(result.error || "No se pudo guardar la corrección."); return; }
      onSuccess();
    } catch (error: any) {
      setError(error.message || "No se pudo guardar la corrección.");
    } finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
    <section role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div><h2 className="text-base font-black text-slate-900">Corregir recibo finalizado</h2><p className="mt-1 text-xs text-slate-500">{receipt.receiptNumber} · Solo cambiaremos la identidad del producto.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Cerrar"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle className="h-4 w-4 shrink-0" />IMEI, cantidad, precio, código y fecha quedan protegidos.</div>
        {items.map((item, index) => <div key={item.itemId} className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-bold text-slate-500">Línea {index + 1}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["brand", "model", "capacity"] as const).map((field) => <label key={field} className="text-xs font-semibold text-slate-700">{field === "brand" ? "Marca" : field === "model" ? "Modelo *" : "Capacidad"}<input value={item[field]} onChange={(event) => update(index, field, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>)}
          </div>
        </div>)}
        {error && <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>}
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700">Cancelar</button><button type="button" disabled={saving} onClick={handleSave} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />{saving ? "Guardando..." : "Guardar corrección"}</button></footer>
    </section>
  </div>;
}
