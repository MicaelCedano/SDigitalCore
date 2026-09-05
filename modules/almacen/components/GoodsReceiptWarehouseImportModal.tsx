"use client";

import { useEffect, useMemo, useState } from "react";
import { getWarehouseProductSuggestionAction, importGoodsReceiptToWarehouseAction } from "../actions/goods-receipt";
import type { GoodsReceiptWarehouseImportInput } from "@/lib/validation/goods-receipt";
import { AlertCircle, ArrowRight, CheckCircle2, LockKeyhole, PackagePlus, Send, ShieldCheck, Sparkles, X } from "lucide-react";

type ImportReceipt = {
  id: string;
  receiptNumber: string;
  items?: Array<{ id?: string; code?: string | null; description?: string | null; model?: string | null; brand?: string | null; capacity?: string | null; quantity?: number | null; colorVariants?: Array<{ color?: string | null; quantity?: number | null; model?: string | null; brand?: string | null; capacity?: string | null }> | null }>;
};
type ImportLine = GoodsReceiptWarehouseImportInput["lines"][number];
type ProductSuggestion = { code: string; unitsPerBox: number; boxes: number; looseUnits: number; totalUnits: number };

function splitProductDescription(description: string | null | undefined) {
  const source = description?.trim() || "Modelo sin nombre";
  const capacityMatch = source.match(/\b(\d+\s*(?:\+|x|\/)\s*\d+\s*(?:GB|TB)?|\d+\s*(?:GB|TB))\b/i);
  const capacity = capacityMatch?.[1]?.replace(/\s+/g, "").toUpperCase() || "";
  const withoutCapacity = (capacityMatch ? source.replace(capacityMatch[0], "") : source).replace(/\s+/g, " ").trim();
  const [brand = "", ...modelParts] = withoutCapacity.split(" ");
  const model = modelParts.join(" ").trim() || brand || source;
  return { brand, model, capacity };
}

function buildLines(receipt: ImportReceipt): ImportLine[] {
  return (receipt.items || []).flatMap((item) => {
    const variants = item.colorVariants && item.colorVariants.length > 0 ? item.colorVariants : [{ color: "", quantity: item.quantity || 1 }];
    const parsed = splitProductDescription(item.model || item.description);
    return variants.map((variant, variantIndex) => ({ variantIndex, itemId: item.id || "", code: item.code || "", name: variant.model?.trim() || item.model?.trim() || parsed.model, brand: variant.brand?.trim() || item.brand?.trim() || parsed.brand, capacity: variant.capacity?.trim() || item.capacity?.trim() || parsed.capacity, color: variant.color?.trim() || "", quantity: Number(variant.quantity) || Number(item.quantity) || 1, unitsPerBox: 1 }));
  });
}

export function GoodsReceiptWarehouseImportModal({ receipt, onClose, onSuccess }: { receipt: ImportReceipt; onClose: () => void; onSuccess: () => void }) {
  const [lines, setLines] = useState<ImportLine[]>(() => buildLines(receipt));
  const [selected, setSelected] = useState(() => buildLines(receipt).map(() => true));
  const [quantities, setQuantities] = useState(() => buildLines(receipt).map((line) => String(line.quantity)));
  const selectedLines = lines.flatMap((line, index) => selected[index] ? [{ ...line, quantity: Number(quantities[index]) }] : []);
  const selectedUnits = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, ProductSuggestion>>({});
  const [lookupDone, setLookupDone] = useState(false);
  const totalUnits = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  useEffect(() => {
    let cancelled = false;
    async function loadSuggestions() {
      const results = await Promise.all(lines.map((line) => getWarehouseProductSuggestionAction({ brand: line.brand, name: line.name, capacity: line.capacity, color: line.color })));
      if (cancelled) return;
      const found: Record<number, ProductSuggestion> = {};
      results.forEach((result, index) => {
        if (result.success && result.matchCount === 1 && result.data) found[index] = result.data;
      });
      setSuggestions(found);
      setLines((current) => current.map((line, index) => {
        const suggestion = found[index];
        if (!suggestion) return line;
        return { ...line, code: line.code || suggestion.code, unitsPerBox: suggestion.unitsPerBox };
      }));
      setLookupDone(true);
    }
    void loadSuggestions();
    return () => { cancelled = true; };
  }, [receipt.id]);

  const updateLine = (index: number, field: "code" | "unitsPerBox", value: string) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: field === "unitsPerBox" ? Math.max(1, Number(value) || 1) : value } : line));
  };

  const updateIdentity = (index: number, field: "brand" | "name" | "capacity" | "color", value: string) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedLines.length || selectedLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1) || lines.some((line, index) => selected[index] && Number(quantities[index]) > line.quantity)) {
      setError("Selecciona al menos un producto e indica una cantidad válida, sin superar lo recibido.");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmImport = async () => {
    setConfirmOpen(false);
    setSaving(true);
    const result = await importGoodsReceiptToWarehouseAction({ receiptId: receipt.id, lines: selectedLines });
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
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-xs text-indigo-900">Marca los productos que se quedan en la casita e indica cuántas unidades ingresan. Lo recibido se conserva completo; solo lo seleccionado se suma al almacén.</div>
            {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <p className="mb-3 text-sm font-semibold text-slate-700">{selectedLines.length} seleccionados · {selectedUnits} unidades al almacén · {Math.max(0, totalUnits - selectedUnits)} fuera</p>
            <div className="mb-3 flex gap-3 text-xs font-semibold text-indigo-700"><button type="button" disabled={saving} onClick={() => setSelected(lines.map(() => true))}>Seleccionar todos</button><button type="button" disabled={saving} onClick={() => setSelected(lines.map(() => false))}>Desmarcar todos</button></div>
            <div className="space-y-3">{lines.map((line, index) => { const entering = selected[index] ? Number(quantities[index]) || 0 : 0; const boxes = Math.floor(entering / line.unitsPerBox); const looseUnits = entering % line.unitsPerBox; const suggestion = suggestions[index]; return <div key={`${line.itemId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><label className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-700"><input type="checkbox" checked={selected[index]} disabled={saving} onChange={(event) => setSelected((current) => current.map((value, i) => i === index ? event.target.checked : value))} /> Ingresar a la casita</label><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">Producto identificado</p><p className="mt-1 text-sm font-bold text-slate-800">{line.brand || "Marca pendiente"} {line.name} {line.capacity && <span className="font-semibold text-slate-500">{line.capacity}</span>}</p></div>{line.color ? <span className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{line.color}</span> : null}</div>{suggestion ? <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><strong>Ya existe en almacén.</strong> Código <strong>{suggestion.code}</strong> · {suggestion.totalUnits.toLocaleString("es-DO")} uds actuales. Esta importación se sumará a ese producto.</span></div> : lookupDone ? <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">No hay una coincidencia exacta; completa el código Kaptas para crear o vincular el producto.</div> : null}<fieldset disabled={!selected[index] || saving} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 disabled:opacity-50"><label className="text-xs font-semibold text-slate-700">Marca<input required value={line.brand} onChange={(event) => updateIdentity(index, "brand", event.target.value)} placeholder="Ej. Oukitel" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">Modelo<input required value={line.name} onChange={(event) => updateIdentity(index, "name", event.target.value)} placeholder="Ej. WP210" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">RAM y almacenamiento<input value={line.capacity} onChange={(event) => updateIdentity(index, "capacity", event.target.value)} placeholder="Ej. 12+512GB" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">Color <span className="font-normal text-slate-400">(opcional)</span><input value={line.color ?? ""} onChange={(event) => updateIdentity(index, "color", event.target.value)} placeholder="Déjalo vacío si no aplica" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-1">Código Kaptas<input required value={line.code} onChange={(event) => updateLine(index, "code", event.target.value)} placeholder="Ej. SAM-A16-AZ" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">Unidades por caja<input required type="number" min={1} value={line.unitsPerBox} onChange={(event) => updateLine(index, "unitsPerBox", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-700">Unidades a ingresar<input required type="number" min={1} max={line.quantity} step={1} value={quantities[index]} onChange={(event) => setQuantities((current) => current.map((value, i) => i === index ? event.target.value : value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label><div className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="block text-[10px] font-semibold uppercase text-slate-500">Recibido</span><strong className="text-slate-800">{line.quantity} uds</strong><span className="block text-[10px] text-slate-500">Ingresan: {boxes} cajas · {looseUnits} sueltas</span></div></fieldset></div>; })}</div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="submit" disabled={saving || !selectedLines.length} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5750f1] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 disabled:opacity-50">{saving ? "Importando..." : <><CheckCircle2 className="h-4 w-4" /> Ingresar selección al almacén</>}</button></div>
        </form>
      </div>
      {confirmOpen && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="warehouse-confirm-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.55)]">
            <div className="bg-gradient-to-br from-indigo-600 via-[#5750f1] to-violet-600 px-6 pb-7 pt-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Send className="h-6 w-6" /></div>
                <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl p-2 text-white/75 transition hover:bg-white/15 hover:text-white" aria-label="Cerrar confirmación"><X className="h-5 w-5" /></button>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-100">Enviar al almacén</p>
              <h3 id="warehouse-confirm-title" className="mt-1 text-xl font-black tracking-tight">¿Confirmar este movimiento?</h3>
              <p className="mt-2 text-sm leading-6 text-indigo-100">El recibo quedará registrado y no podrá enviarse nuevamente.</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Recibo</p><p className="mt-1 font-mono text-sm font-bold text-slate-800">{receipt.receiptNumber}</p></div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="text-right"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Cantidad</p><p className="mt-1 text-lg font-black text-indigo-600">{selectedUnits.toLocaleString("es-DO")} <span className="text-xs font-bold text-slate-500">uds.</span></p></div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div><p className="text-sm font-bold">Solo se ingresará lo seleccionado</p><p className="mt-1 text-xs leading-5 text-amber-800">{totalUnits - selectedUnits} unidades quedan fuera del almacén. Esta entrada cierra el envío del recibo; para cambiar la selección después, debes cancelar la entrada y volver a ingresarla.</p></div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Revisa que las cantidades y códigos estén correctos.</div>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Volver a revisar</button><button type="button" onClick={() => void confirmImport()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"><Send className="h-4 w-4" /> Confirmar envío</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

