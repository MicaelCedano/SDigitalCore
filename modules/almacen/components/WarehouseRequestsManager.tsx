"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Search, Send, XCircle } from "lucide-react";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { getWarehouseProductsAction, createWarehouseRequestAction, getWarehouseRequestsAction, updateWarehouseRequestStatusAction } from "../actions/warehouse";

export function WarehouseRequestsManager() {
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<"ENTRY" | "EXIT">("EXIT");
  const [branch, setBranch] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [r, p, b] = await Promise.all([getWarehouseRequestsAction(search, "ALL"), getWarehouseProductsAction(), getBranchesAction(true)]);
    if (r.success) setRequests(r.data ?? []);
    if (p.success) setProducts(p.data ?? []);
    if (b.success) { setBranches(b.data ?? []); setBranch(b.data?.[0]?.name ?? ""); }
  };
  useEffect(() => { void load(); }, [search]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    const items = Object.entries(selected).map(([productId, unitsCount]) => ({ productId, unitsCount }));
    if (!branch || !reason.trim() || items.length === 0) { setError("Indica sucursal, motivo y al menos un producto."); return; }
    setSaving(true);
    const result = await createWarehouseRequestAction({ title: reason.trim(), branch, type, details: reason.trim(), items, status: "PENDING" });
    setSaving(false);
    if (!result.success) { setError(result.error ?? "No se pudo enviar la solicitud."); return; }
    setShowCreate(false); setSelected({}); setReason(""); await load();
  };

  const update = async (id: string, status: "APPROVED" | "REJECTED") => {
    const result = await updateWarehouseRequestStatusAction(id, status);
    if (!result.success) setError(result.error ?? "No se pudo procesar la solicitud.");
    await load();
  };

  const filtered = products.filter((p) => `${p.name} ${p.brand ?? ""} ${p.code}`.toLowerCase().includes(productSearch.toLowerCase()));
  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold text-slate-800">Solicitudes de almacÃ©n</h1><p className="text-xs text-slate-500">El almacenista solicita; el administrador aprueba y aplica el movimiento.</p></div>
      <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#5750f1] px-4 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline h-4 w-4" />Nueva solicitud</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
    <div className="flex items-center gap-2"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar solicitudes..." className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-bold"><tr><th className="p-3">CÃ³digo</th><th className="p-3">Tipo</th><th className="p-3">Productos</th><th className="p-3">Solicitante</th><th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((r) => <tr key={r.id}><td className="p-3 font-mono text-[#5750f1]">{r.requestCode}</td><td className="p-3 font-bold">{r.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</td><td className="p-3">{r.items?.map((i: any) => `${i.product?.name ?? i.productId} (${i.unitsCount})`).join(", ")}</td><td className="p-3">{r.requestedBy}</td><td className="p-3">{r.status === "PENDING" ? "PENDIENTE" : r.status === "APPROVED" ? "APROBADA" : "RECHAZADA"}</td><td className="p-3 text-right">{r.status === "PENDING" && <span className="inline-flex gap-1"><button onClick={() => void update(r.id, "APPROVED")} className="rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-700"><CheckCircle2 className="inline h-3 w-3" /> Aprobar</button><button onClick={() => void update(r.id, "REJECTED")} className="rounded bg-red-50 px-2 py-1 font-bold text-red-700"><XCircle className="inline h-3 w-3" /> Rechazar</button></span>}</td></tr>)}</tbody></table>{requests.length === 0 && <div className="p-10 text-center text-xs text-slate-500"><Send className="mx-auto mb-2 h-8 w-8 text-slate-300" />No hay solicitudes.</div>}</div>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><h2 className="mb-4 text-lg font-bold">Nueva solicitud de movimiento</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Tipo<select value={type} onChange={(e) => setType(e.target.value as any)} className="mt-1 w-full rounded-lg border p-2"><option value="EXIT">Salida</option><option value="ENTRY">Entrada</option></select></label><label className="text-xs font-semibold">Sucursal<select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 w-full rounded-lg border p-2">{branches.map((b) => <option key={b.id}>{b.name}</option>)}</select></label></div><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo / referencia" className="mt-3 w-full rounded-lg border p-2 text-xs" /><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto" className="mt-3 w-full rounded-lg border p-2 text-xs" /><div className="mt-2 max-h-56 overflow-auto rounded-lg border">{filtered.map((p) => <div key={p.id} className="flex items-center justify-between border-b p-2 text-xs"><span>{p.name} <small className="text-slate-400">({p.totalUnits} uds)</small></span><input type="number" min={selected[p.id] ? 1 : 0} value={selected[p.id] ?? 0} onChange={(e) => { const n = Number(e.target.value); setSelected((s) => { const next = { ...s }; if (n > 0) next[p.id] = n; else delete next[p.id]; return next; }); }} className="w-20 rounded border p-1 text-center" /></div>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={saving} className="rounded-lg bg-[#5750f1] px-4 py-2 text-xs font-bold text-white">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enviar solicitud"}</button></div></form></div>}
  </div>;
}

