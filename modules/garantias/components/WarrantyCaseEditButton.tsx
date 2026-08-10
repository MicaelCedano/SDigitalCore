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
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-warranty-title"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5750f1]">Corrección auditada</p><h2 id="edit-warranty-title" className="mt-2 text-xl font-black text-slate-800">Editar {item.caseCode}</h2><p className="mt-1 text-sm text-slate-500">Los valores anteriores y nuevos quedarán en el historial.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Cliente<input required maxLength={160} value={form.clientName} onChange={(event) => update("clientName", event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold text-slate-700">Modelo<input required maxLength={120} value={form.model} onChange={(event) => update("model", event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">IMEI<input required minLength={15} maxLength={15} inputMode="numeric" value={form.imei} onChange={(event) => update("imei", event.target.value.replace(/\D/g, ""))} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 font-mono" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Falla reportada<textarea required maxLength={1000} value={form.problem} onChange={(event) => update("problem", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3" /></label></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={busy} className="rounded-xl bg-[#5750f1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando..." : "Guardar corrección"}</button></div></form></div>}
  </>;
}
