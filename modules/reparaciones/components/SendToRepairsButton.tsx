"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, UserRoundCheck, X, Wrench } from "lucide-react";
import { getRepairTechniciansAction, sendCasesToRepairsAction } from "@/modules/reparaciones/actions/repairs";

export function SendToRepairsButton({ caseCode, disabled = false }: { caseCode: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  async function openModal() {
    setOpen(true);
    setMessage("");
    setTechnicianId("");
    setLoadingList(true);
    const res = await getRepairTechniciansAction();
    setLoadingList(false);
    if (res.success) {
      setTechnicians(res.data);
      if (res.data.length === 1) setTechnicianId(res.data[0].id);
    } else {
      setMessageTone("error");
      setMessage(res.error);
    }
  }

  async function handleSend() {
    if (!technicianId) {
      setMessageTone("error");
      setMessage("Selecciona el técnico de reparaciones.");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await sendCasesToRepairsAction({ caseCodes: [caseCode], technicianId });
    setBusy(false);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return;
    }
    setMessageTone("ok");
    setMessage(`Caso enviado a reparaciones. Documento ${(res.data as any)?.documentCode ?? ""} generado.`);
    window.dispatchEvent(new Event("warranty-data-changed"));
    setTimeout(() => setOpen(false), 900);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#5750f1]/30 bg-[#5750f1]/10 px-5 py-2.5 text-sm font-bold text-[#5750f1] transition hover:bg-[#5750f1]/20 disabled:cursor-not-allowed disabled:opacity-50"
        title="Enviar este caso al módulo de Reparaciones"
      >
        <Wrench size={16} /> Enviar a Reparaciones
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.55)]">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 text-[#5750f1]">
                  <Send size={18} />
                </span>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900">Enviar a Reparaciones</h2>
                  <p className="text-[11px] text-slate-500 font-mono">{caseCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </header>

            <div className="space-y-4 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Técnico de reparaciones</p>
                {loadingList ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando técnicos...
                  </p>
                ) : technicians.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-700">
                    No hay técnicos con el módulo Reparaciones. Configúralo en Usuarios y roles.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {technicians.map((t) => (
                      <label
                        key={t.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          technicianId === t.id ? "border-[#5750f1] bg-[#5750f1]/10" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="repair-technician"
                          checked={technicianId === t.id}
                          onChange={() => setTechnicianId(t.id)}
                          className="h-4 w-4 accent-[#5750f1]"
                        />
                        <UserRoundCheck className="w-4 h-4 text-[#5750f1]" />
                        <span className="text-sm font-semibold text-slate-800">{t.name || t.username}</span>
                        {t.roleCode === "ADMIN" && (
                          <span className="ml-auto rounded-full bg-[#5750f1]/10 px-2 py-0.5 text-[10px] font-bold text-[#5750f1]">
                            ADMIN
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {message && (
                <p
                  role="status"
                  className={`rounded-xl border p-3 text-xs font-medium ${
                    messageTone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message}
                </p>
              )}
            </div>

            <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={busy || technicians.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={15} />}
                {busy ? "Enviando..." : "Enviar a Reparaciones"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
