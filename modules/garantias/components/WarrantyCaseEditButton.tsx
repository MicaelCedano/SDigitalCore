"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateWarrantyCaseDetails } from "@/modules/garantias/actions/warranty";

type EditableCase = { caseCode: string; clientName: string; model: string; imei: string; problem: string };

export function WarrantyCaseEditButton({ item }: { item: EditableCase }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof EditableCase, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await updateWarrantyCaseDetails(form);
    setBusy(false);
    if (!result.success) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#5750f1]/20 px-2.5 py-2 text-xs font-bold text-[#5750f1] transition hover:bg-[#5750f1]/10"><Pencil size={14} /> Corregir datos</button>
    {open && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="edit-warranty-title"><form onSubmit={submit} className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"><div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70"><div className="flex items-center gap-3"><div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20"><Pencil className="w-6 h-6" /></div><div><h2 id="edit-warranty-title" className="text-lg font-bold text-slate-800">Editar {item.caseCode}</h2><p className="text-xs text-slate-500">Los valores anteriores y nuevos quedarán en el historial.</p></div></div><button type="button" onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Cerrar"><X className="w-5 h-5" /></button></div><div className="p-6 overflow-y-auto flex-1 bg-white grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Cliente<input required maxLength={160} value={form.clientName} onChange={(event) => update("clientName", event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label><label className="text-sm font-semibold text-slate-700">Modelo<input required maxLength={120} value={form.model} onChange={(event) => update("model", event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">IMEI<input required minLength={15} maxLength={15} inputMode="numeric" value={form.imei} onChange={(event) => update("imei", event.target.value.replace(/\D/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Falla reportada<textarea required maxLength={1000} value={form.problem} onChange={(event) => update("problem", event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 p-3.5 outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label>{error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div><div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button disabled={busy} className="rounded-xl bg-[#5750f1] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:opacity-50">{busy ? "Guardando..." : "Guardar corrección"}</button></div></form></div>}
  </>;
}
