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
    {open && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="warranty-archive-title">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${archived ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}><Icon className="w-6 h-6" /></div>
            <div><h2 id="warranty-archive-title" className="text-lg font-bold text-slate-800">¿{archived ? "Restaurar" : "Archivar"} {caseCode}?</h2><p className="text-xs text-slate-500">{archived ? "El caso volverá a aparecer en el flujo operativo." : "Se ocultará de los casos activos, pero conservará su historial y documentos."}</p></div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <label className="block text-sm font-semibold text-slate-700">{archived ? "Observación (opcional)" : "Motivo"}<textarea required={!archived} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={archived ? "Ej. Registro revisado y habilitado" : "Ej. Registro duplicado"} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="button" onClick={submit} disabled={busy} className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${archived ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-red-600 hover:bg-red-700 shadow-red-600/20"}`}>{busy ? "Procesando..." : archived ? "Restaurar caso" : "Archivar caso"}</button></div>
      </div>
    </div>}
  </>;
}
