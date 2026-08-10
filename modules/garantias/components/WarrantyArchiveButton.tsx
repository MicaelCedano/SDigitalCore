"use client";

import { useState } from "react";
import { Archive, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { archiveWarrantyCase, restoreWarrantyCase } from "@/modules/garantias/actions/warranty";

export function WarrantyArchiveButton({ caseCode, archived }: { caseCode: string; archived: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!archived && !reason.trim()) return setError("Indica el motivo para retirar este caso.");
    setBusy(true);
    setError("");
    const result = archived ? await restoreWarrantyCase(caseCode, reason) : await archiveWarrantyCase(caseCode, reason);
    setBusy(false);
    if (!result.success) return setError(result.error);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  const Icon = archived ? RotateCcw : Archive;
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${archived ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-700 hover:bg-red-50"}`}>
      <Icon size={14} /> {archived ? "Restaurar" : "Archivar"}
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="warranty-archive-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><p className={`text-xs font-bold uppercase tracking-[0.15em] ${archived ? "text-emerald-600" : "text-red-600"}`}>{archived ? "Volver al panel" : "Retirar caso"}</p><h2 id="warranty-archive-title" className="mt-2 text-xl font-black text-[#101828]">¿{archived ? "Restaurar" : "Archivar"} {caseCode}?</h2><p className="mt-2 text-sm text-[#667085]">{archived ? "El caso volverá a aparecer en el flujo operativo." : "Se ocultará de los casos activos, pero conservará su historial y documentos."}</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7]" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-[#344054]">{archived ? "Observación (opcional)" : "Motivo"}<textarea required={!archived} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={archived ? "Ej. Registro revisado y habilitado" : "Ej. Registro duplicado"} className="mt-2 min-h-24 w-full rounded-xl border border-[#d0d5dd] p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-semibold text-[#344054]">Cancelar</button><button type="button" onClick={submit} disabled={busy} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${archived ? "bg-emerald-600" : "bg-red-600"}`}>{busy ? "Procesando..." : archived ? "Restaurar caso" : "Archivar caso"}</button></div>
      </div>
    </div>}
  </>;
}
