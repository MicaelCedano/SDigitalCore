"use client";

import { useState } from "react";
import { Archive, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { archiveWarrantyCase } from "@/modules/garantias/actions/warranty";

export function WarrantyArchiveButton({ caseCode }: { caseCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason.trim()) return setError("Indica el motivo para retirar este caso.");
    setBusy(true); setError("");
    const result = await archiveWarrantyCase(caseCode, reason);
    setBusy(false);
    if (!result.success) return setError(result.error);
    setOpen(false); setReason(""); router.refresh();
  }

  return <><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50" title="Retirar caso del panel"><Archive size={14} /> Archivar</button>{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Archivar caso"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">Retirar caso</p><h2 className="mt-2 text-xl font-black text-[#101828]">¿Archivar {caseCode}?</h2><p className="mt-2 text-sm text-[#667085]">Se ocultará de los casos activos, pero conservará su historial y documentos.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7]" aria-label="Cerrar"><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-[#344054]">Motivo<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Registro duplicado" className="mt-2 min-h-24 w-full rounded-xl border border-[#d0d5dd] p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-semibold text-[#344054]">Cancelar</button><button type="button" onClick={submit} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Archivando..." : "Archivar caso"}</button></div></div></div>}</>;
}
