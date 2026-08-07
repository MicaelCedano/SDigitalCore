"use client";

import { useState, type ChangeEvent } from "react";
import { FileUp, LoaderCircle, Zap } from "lucide-react";
import { classifyChargersFromPDF, type ChargerCategory, type ChargerClassificationItem } from "../actions/charger-classification";

const labels: Record<ChargerCategory, { title: string; color: string }> = {
  USB_LIGHTNING_10W: { title: "USB-Lightning · 10W", color: "text-amber-700 bg-amber-50 border-amber-200" },
  TPC_LIGHTNING_20W: { title: "TPC-Lightning · 20W", color: "text-blue-700 bg-blue-50 border-blue-200" },
  TPC_LIGHTNING_33W: { title: "TPC-Lightning · 33W", color: "text-purple-700 bg-purple-50 border-purple-200" },
  TPC_TPC_33W: { title: "TPC-TPC · 33W", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

const categoryOrder = Object.keys(labels) as ChargerCategory[];

export function ChargerClassifier() {
  const [result, setResult] = useState<Record<ChargerCategory, ChargerClassificationItem[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await classifyChargersFromPDF(formData);
      if (!response.success) {
        setMessage(response.error);
        return;
      }
      setResult(response.data);
      setMessage("Factura procesada correctamente.");
    } catch {
      setMessage("No se pudo procesar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  const total = result ? categoryOrder.reduce((sum, category) => sum + result[category].reduce((subtotal, item) => subtotal + item.quantity, 0), 0) : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Zap className="h-5 w-5 text-amber-500" /> Calculador de cargadores</h2>
          <p className="mt-1 text-xs text-slate-500">Sube una factura de iPhones y calcula automáticamente el tipo de cargador.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700">
          <input type="file" accept="application/pdf" className="sr-only" onChange={handleUpload} disabled={loading} />
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {loading ? "Calculando..." : "Subir factura PDF"}
        </label>
      </div>

      <div className="p-6">
        {message && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{message}</p>}
        {!result ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">Los resultados aparecerán aquí después de subir una factura.</div>
        ) : (
          <>
            <div className="mb-5 rounded-xl bg-slate-900 p-4 text-white">
              <span className="text-xs text-slate-300">Total de equipos clasificados</span>
              <strong className="mt-1 block text-3xl">{total}</strong>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {categoryOrder.map((category) => {
                const items = result[category];
                const count = items.reduce((sum, item) => sum + item.quantity, 0);
                return <div key={category} className={`rounded-xl border p-4 ${labels[category].color}`}>
                  <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-black uppercase tracking-wide">{labels[category].title}</h3><span className="text-2xl font-black">{count}</span></div>
                  {items.length > 0 ? <ul className="mt-3 space-y-2 text-xs">{items.map((item, index) => <li key={`${item.description}-${index}`} className="flex justify-between gap-3 border-t border-current/10 pt-2"><span>{item.description}</span><strong>×{item.quantity}</strong></li>)}</ul> : <p className="mt-3 text-xs opacity-70">Sin equipos en esta categoría.</p>}
                </div>;
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
