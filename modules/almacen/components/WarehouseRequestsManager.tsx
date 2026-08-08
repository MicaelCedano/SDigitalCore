"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, MessageCircle, PackagePlus, Plus, Printer, RefreshCw, Search, Send, X, XCircle } from "lucide-react";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { createWarehouseRequestAction, getWarehouseProductsAction, getWarehouseRequestsAction, updateWarehouseRequestStatusAction } from "../actions/warehouse";

type MovementType = "ENTRY" | "EXIT";
type Measure = "BOXES" | "UNITS";
type SelectedChoice = { quantity: number; measure: Measure };

export function WarehouseRequestsManager({ roleCode = "ADMIN" }: { roleCode?: string }) {
  const isAdmin = roleCode === "ADMIN";
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<MovementType>("EXIT");
  const [branch, setBranch] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, SelectedChoice>>({});
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [voucherRequest, setVoucherRequest] = useState<any | null>(null);

  const load = async () => {
    const [r, p, b] = await Promise.all([getWarehouseRequestsAction(search, "ALL"), getWarehouseProductsAction(), getBranchesAction(true)]);
    if (r.success) setRequests(r.data ?? []);
    if (p.success) setProducts(p.data ?? []);
    if (b.success) {
      setBranches(b.data ?? []);
      setBranch((current) => current || b.data?.[0]?.name || "");
    }
  };

  useEffect(() => { void load(); }, [search]);

  const availableProducts = useMemo(() => products.filter((p) => type === "ENTRY" || Number(p.totalUnits) > 0), [products, type]);
  const filtered = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return availableProducts.filter((p) => !selected[p.id] && (!query || `${p.name} ${p.brand ?? ""} ${p.code}`.toLowerCase().includes(query)));
  }, [availableProducts, productSearch, selected]);
  const selectedItems = Object.entries(selected).map(([productId, choice]) => {
    const product = products.find((p) => p.id === productId);
    return product ? { product, choice, unitsCount: choice.measure === "BOXES" ? choice.quantity * (product.unitsPerBox || 1) : choice.quantity } : null;
  }).filter(Boolean) as Array<{ product: any; choice: SelectedChoice; unitsCount: number }>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const items = Object.entries(selected).filter(([, choice]) => choice.quantity > 0).map(([productId, choice]) => {
      const product = products.find((item) => item.id === productId);
      const unitsCount = choice.measure === "BOXES" ? choice.quantity * (product?.unitsPerBox || 1) : choice.quantity;
      return { productId, unitsCount, measure: choice.measure, quantity: choice.quantity };
    });
    if (!branch) {
      setError("Selecciona una sucursal.");
      return;
    }
    if (items.length === 0) {
      setError("Añade al menos un producto y define su cantidad.");
      return;
    }
    const reference = reason.trim() || `Solicitud de ${type === "ENTRY" ? "entrada" : "salida"}`;
    setSaving(true);
    const result = await createWarehouseRequestAction({ title: reference, branch, type, details: reason.trim() || null, items, status: "PENDING" });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo enviar la solicitud.");
      return;
    }
    setShowCreate(false);
    setSelected({});
    setReason("");
    setProductSearch("");
    await load();
  };

  const update = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (updatingId) return;
    setError("");
    setUpdatingId(id);
    try {
      const result = await updateWarehouseRequestStatusAction(id, status);
      if (!result.success) setError(result.error ?? "No se pudo procesar la solicitud.");
      await load();
    } finally {
      setUpdatingId(null);
    }
  };

  const setQuantity = (productId: string, value: number, measure: Measure, max?: number) => {
    const quantity = Math.max(1, Math.min(Number.isFinite(value) ? value : 1, max ?? Number.MAX_SAFE_INTEGER));
    setSelected((current) => ({ ...current, [productId]: { quantity, measure } }));
  };

  const removeSelected = (productId: string) => setSelected((current) => {
    const next = { ...current };
    delete next[productId];
    return next;
  });

  const voucherText = (request: any) => {
    const lines = (request.items ?? []).map((item: any) => `${item.product?.name ?? item.productId}: ${item.unitsCount} uds`).join("\n");
    return `BOUCHER DE SOLICITUD ${request.requestCode}\n${request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}\nSucursal: ${request.branch}\nSolicitante: ${request.requestedBy}\nProductos:\n${lines}\nEstado: ${request.status === "PENDING" ? "Pendiente de aprobación" : request.status === "APPROVED" ? "Aprobada" : "Rechazada"}`;
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><h1 className="text-xl font-bold text-slate-900">Solicitudes de almacén</h1><p className="mt-1 text-sm text-slate-500">{isAdmin ? "Revisa, aprueba y procesa las solicitudes de movimiento." : "Envía solicitudes y espera la aprobación del administrador."}</p></div>
      <button onClick={() => { setError(""); setShowCreate(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4841d7]"><Plus className="h-4 w-4" />Nueva solicitud</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="flex items-center gap-2"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar solicitudes..." className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 font-bold text-slate-600"><tr><th className="p-4">Código</th><th className="p-4">Tipo</th><th className="p-4">Productos</th><th className="p-4">Solicitante</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((r) => { const isUpdating = updatingId === r.id; return <tr key={r.id} className="hover:bg-slate-50/70"><td className="p-4 font-mono text-xs font-bold text-[#5750f1]">{r.requestCode}</td><td className="p-4 font-bold">{r.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</td><td className="p-4">{r.items?.map((i: any) => `${i.product?.name ?? i.productId} (${i.unitsCount})`).join(", ")}</td><td className="p-4">{r.requestedBy}</td><td className="p-4">{r.status === "PENDING" ? (isAdmin ? "PENDIENTE" : <span className="font-semibold text-amber-600">Esperando aprobación</span>) : r.status === "APPROVED" ? "APROBADA" : "RECHAZADA"}</td><td className="p-4 text-right"><span className="inline-flex flex-wrap justify-end gap-1">{<button onClick={() => setVoucherRequest(r)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700"><Printer className="h-3.5 w-3.5" />Boucher</button>}{isAdmin && r.status === "PENDING" && <><button disabled={!!updatingId} onClick={() => void update(r.id, "APPROVED")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700 disabled:cursor-wait disabled:opacity-60">{isUpdating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isUpdating ? "Procesando..." : "Aprobar"}</button><button disabled={!!updatingId} onClick={() => void update(r.id, "REJECTED")} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 font-bold text-red-700 disabled:cursor-wait disabled:opacity-60"><XCircle className="h-3.5 w-3.5" />Rechazar</button></>}{!isAdmin && r.status === "PENDING" && <span className="self-center text-xs font-semibold text-slate-400">Esperando aprobación</span>}</span></td></tr>; })}</tbody></table>{requests.length === 0 && <div className="p-12 text-center text-sm text-slate-500"><Send className="mx-auto mb-2 h-8 w-8 text-slate-300" />No hay solicitudes.</div>}</div>

    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-8"><div><div className="mb-1 flex items-center gap-2 text-[#5750f1]"><PackagePlus className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-wider">Almacén</span></div><h2 className="text-2xl font-bold text-slate-900">Nueva solicitud de movimiento</h2><p className="mt-1 text-sm text-slate-500">Añade productos y después indica la presentación y cantidad.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
      <div className="space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Tipo<select value={type} onChange={(e) => { setType(e.target.value as MovementType); setSelected({}); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5750f1]"><option value="EXIT">Salida de cajas o sueltas</option><option value="ENTRY">Entrada de cajas o sueltas</option></select></label><label className="text-sm font-semibold text-slate-700">Sucursal<select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5750f1]">{branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</select></label></div>
        <label className="block text-sm font-semibold text-slate-700">Motivo o referencia <span className="font-normal text-slate-400">(opcional)</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Puedes agregar una referencia..." className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#5750f1] focus:bg-white" /></label>
        <div className="rounded-2xl border border-[#dcd9ff] bg-[#f7f7ff] p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Productos añadidos a la solicitud</p><p className="mt-0.5 text-xs text-slate-500">Añade primero los productos y define aquí la presentación y cantidad.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#5750f1]">{selectedItems.length}</span></div>{selectedItems.length === 0 ? <div className="rounded-xl border border-dashed border-[#bdb8ff] bg-white px-4 py-5 text-center text-sm text-slate-500">Todavía no has añadido productos.</div> : <div className="space-y-2">{selectedItems.map(({ product, choice, unitsCount }) => <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e3ff] bg-white px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{product.name}</p><p className="text-xs text-slate-500">{product.code} · <span className="font-semibold text-[#5750f1]">{unitsCount} uds solicitadas</span></p></div><div className="flex items-center gap-2"><select aria-label={`Presentación de ${product.name}`} value={choice.measure} onChange={(e) => setQuantity(product.id, choice.quantity, e.target.value as Measure, type === "EXIT" ? (e.target.value === "BOXES" ? product.boxes : product.looseUnits) : undefined)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold"><option value="BOXES">Cajas</option><option value="UNITS">Sueltas</option></select><input aria-label={`Cantidad de ${product.name}`} type="number" min={1} max={type === "EXIT" ? (choice.measure === "BOXES" ? product.boxes : product.looseUnits) : undefined} value={choice.quantity} onChange={(e) => setQuantity(product.id, Number(e.target.value), choice.measure, type === "EXIT" ? (choice.measure === "BOXES" ? product.boxes : product.looseUnits) : undefined)} className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-center text-sm font-bold outline-none focus:border-[#5750f1]" /><button type="button" aria-label={`Quitar ${product.name}`} onClick={() => removeSelected(product.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button></div></div>)}</div>}<div className="mt-3 flex justify-between border-t border-[#e5e3ff] pt-3 text-sm font-bold text-slate-900"><span>Total solicitado</span><span>{selectedItems.reduce((sum, item) => sum + item.unitsCount, 0)} uds</span></div></div>
        <div><label className="block text-sm font-semibold text-slate-700">Añadir productos</label><div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder={type === "EXIT" ? "Buscar entre productos con stock..." : "Buscar producto..."} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#5750f1] focus:bg-white" /></div><div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200">{filtered.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">{type === "EXIT" ? "No hay más productos con unidades disponibles." : "No se encontraron productos."}</p> : filtered.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{p.name}</p><p className="text-xs text-slate-500">{p.code} · <span className="font-semibold text-emerald-600">{p.totalUnits} uds disponibles</span></p></div><button type="button" onClick={() => setSelected((current) => ({ ...current, [p.id]: { quantity: 1, measure: p.boxes > 0 ? "BOXES" : "UNITS" } }))} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#5750f1] px-3 py-2 text-xs font-bold text-white hover:bg-[#4841d7]"><Plus className="h-3.5 w-3.5" />Añadir</button></div>)}</div></div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 sm:px-8"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4841d7] disabled:opacity-60">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar solicitud</button></div>
    </form></div>}
    {voucherRequest && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 pb-4"><div><p className={`text-xs font-bold ${voucherRequest.type === "ENTRY" ? "text-emerald-600" : "text-rose-600"}`}>BOUCHER DE SOLICITUD</p><h2 className="text-xl font-black text-slate-900">{voucherRequest.requestCode}</h2><p className="mt-1 text-xs text-slate-500">{voucherRequest.branch} · {voucherRequest.requestedBy}</p></div><button type="button" onClick={() => setVoucherRequest(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="space-y-2 py-4">{(voucherRequest.items ?? []).map((item: any) => <div key={item.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span><strong>{item.product?.code}</strong> · {item.product?.name ?? item.productId}</span><strong>{item.unitsCount} uds</strong></div>)}</div><div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-black"><span>{voucherRequest.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span><span>{voucherRequest.status === "PENDING" ? "Esperando aprobación" : voucherRequest.status === "APPROVED" ? "Aprobada" : "Rechazada"}</span></div><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"><Printer className="h-4 w-4" />Imprimir / PDF</button><button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(voucherText(voucherRequest))}`, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</button></div></div></div>}
  </div>;
}
