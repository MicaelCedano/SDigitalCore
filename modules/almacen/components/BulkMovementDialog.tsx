"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Download, Plus, Search, Trash2, X } from "lucide-react";
import { createWarehouseMovementsBulkAction } from "../actions/warehouse";

type Product = {
  id: string;
  code: string;
  name: string;
  brand?: string | null;
  color?: string | null;
  capacity?: string | null;
  boxes: number;
  totalUnits: number;
  looseUnits?: number;
};

type MovementType = "ENTRY" | "EXIT";

export function BulkMovementDialog({ products, type, onComplete }: { products: Product[]; type: MovementType; onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Array<{ product: Product; units: number }>>([]);
  const [reason, setReason] = useState(type === "ENTRY" ? "Recepción de mercancía" : "Despacho de mercancía");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || [p.code, p.name, p.brand, p.color, p.capacity].some((value) => value?.toLowerCase().includes(q)));
  }, [products, search]);

  const close = () => { setOpen(false); setSelected([]); setSearch(""); setError(null); };
  const add = (product: Product) => {
    if (selected.some((item) => item.product.id === product.id)) return;
    setSelected((items) => [...items, { product, units: 1 }]);
  };
  const updateUnits = (id: string, units: number) => setSelected((items) => items.map((item) => item.product.id === id ? { ...item, units: Math.max(1, units || 1) } : item));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) { setError("Agregue al menos un modelo."); return; }
    if (!reason.trim()) { setError("Indique el motivo del movimiento."); return; }
    setSaving(true); setError(null);
    const result = await createWarehouseMovementsBulkAction({ type, reason, items: selected.map((item) => ({ productId: item.product.id, unitsCount: item.units })) });
    setSaving(false);
    if (!result.success) { setError(result.error); return; }
    setVoucher({ ...result.data, items: selected.map((item) => ({ ...item.product, unitsCount: item.units })) });
    close();
    onComplete();
  };

  const total = voucher?.items?.reduce((sum: number, item: any) => sum + item.unitsCount, 0) ?? 0;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`px-4 py-2.5 ${type === "ENTRY" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} text-white rounded-xl text-xs font-bold flex items-center gap-1.5`}>
        {type === "ENTRY" ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
        Registrar {type === "ENTRY" ? "Entrada" : "Salida"} por unidades
      </button>

      {open && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between"><h2 className="font-bold text-slate-800">Nueva {type === "ENTRY" ? "entrada" : "salida"} de mercancía</h2><button onClick={close} className="text-slate-400"><X /></button></div>
          <form onSubmit={submit} className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">{error}</div>}
            <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar código, producto o marca..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              {search && <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">{filtered.map((p) => <button type="button" key={p.id} onClick={() => add(p)} className="w-full px-3 py-2 text-left hover:bg-slate-50 text-xs flex justify-between"><span><strong>{p.code}</strong> {p.name}</span><span className="text-slate-500">{p.totalUnits} uds</span></button>)}</div>}
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">{selected.map((item) => <div key={item.product.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl"><div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{item.product.name}</p><p className="text-[11px] text-slate-500">Disponible: {item.product.totalUnits} uds Â· Sueltas: {item.product.looseUnits || 0}</p></div><input type="number" min={1} value={item.units} onChange={(e) => updateUnits(item.product.id, Number(e.target.value))} className="w-24 px-2 py-2 text-xs font-bold border border-slate-200 rounded-lg" /><button type="button" onClick={() => setSelected((items) => items.filter((entry) => entry.product.id !== item.product.id))} className="text-red-500"><Trash2 className="w-4 h-4" /></button></div>)}{selected.length === 0 && <p className="p-5 text-center text-xs text-slate-400">Busque y agregue los modelos que forman parte del movimiento.</p>}</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo del despacho o entrada" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={close} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Cancelar</button><button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-xl text-xs font-bold ${type === "ENTRY" ? "bg-emerald-600" : "bg-rose-600"}`}>{saving ? "Guardando..." : "Confirmar movimiento"}</button></div>
          </form>
        </div>
      </div>}

      {voucher && <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6" id="warehouse-voucher"><div className="flex items-center justify-between border-b pb-4"><div><p className={`text-xs font-bold ${type === "ENTRY" ? "text-emerald-600" : "text-rose-600"}`}>COMPROBANTE DE {type === "ENTRY" ? "ENTRADA" : "SALIDA"}</p><h2 className="text-xl font-black text-slate-800">Almacén Casita</h2></div><CheckCircle2 className="text-emerald-600" /></div><div className="py-4 space-y-2">{voucher.items.map((item: any) => <div key={item.id} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span><strong>{item.code}</strong> Â· {item.name}</span><strong>{item.unitsCount} uds</strong></div>)}</div><div className="flex justify-between font-black text-slate-800 border-t pt-3"><span>Total unidades</span><span>{total} uds</span></div><p className="text-xs text-slate-500 mt-3">{voucher.reason}</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Imprimir / Guardar PDF</button><button onClick={() => setVoucher(null)} className="px-4 py-2 bg-[#5750f1] text-white rounded-xl text-xs font-bold">Cerrar</button></div></div></div>}
    </>
  );
}
