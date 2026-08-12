"use client";

import { useMemo, useState } from "react";
import { Loader2, Lock, X, Smartphone, User, AlertTriangle } from "lucide-react";
import { createUnlockRequestAction } from "@/modules/desbloqueos/actions/unlocks";

export function CreateUnlockRequestModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (result: { requestCode: string }) => void;
}) {
  const [modelo, setModelo] = useState("");
  const [imeisText, setImeisText] = useState("");
  const [observacion, setObservacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const imeisList = useMemo(
    () =>
      imeisText
        .split(/[\s,;\n\r]+/)
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
    [imeisText]
  );

  const duplicadosEnLista = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of imeisList) counts.set(i, (counts.get(i) || 0) + 1);
    return Array.from(counts.entries()).filter(([, c]) => c > 1).map(([imei]) => imei);
  }, [imeisList]);

  async function handleSubmit() {
    setError("");
    if (!modelo.trim()) return setError("Indica el modelo (ej. Vortex HD65 Ultra)");
    if (imeisList.length === 0) return setError("Pega al menos un IMEI");
    if (duplicadosEnLista.length > 0) return setError(`Hay IMEIs repetidos: ${duplicadosEnLista.join(", ")}`);

    setBusy(true);
    const res = await createUnlockRequestAction({
      model: modelo.trim(),
      imeis: imeisList,
      observacion: observacion.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) return setError(res.error);
    onSubmit({ requestCode: res.data.requestCode });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#5750f1]/20 bg-[#5750f1]/10 text-[#5750f1]">
              <Lock size={23} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
                Solicitar desbloqueo
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                RD$25 por IMEI · pendiente de aprobación del administrador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X size={21} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Modelo</span>
              <input
                value={modelo}
                onChange={(event) => setModelo(event.target.value)}
                placeholder="Ej. Vortex HD65 Ultra"
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Equipos</span>
              <div className="mt-2 flex h-11 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3">
                <span className="text-sm font-bold text-slate-700">{imeisList.length} IMEI(s)</span>
                <span className="text-xs font-black text-emerald-600">
                  RD$ {(imeisList.length * 25).toLocaleString("es-DO")}
                </span>
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> IMEIs (uno por línea o separados por coma)
            </span>
            <textarea
              value={imeisText}
              onChange={(event) => setImeisText(event.target.value)}
              placeholder={"Pega los IMEIs aquí...\n356789012345678\n356789012345679"}
              className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Observación (opcional)
            </span>
            <textarea
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              placeholder="Notas para el administrador..."
              maxLength={1000}
              className="mt-2 min-h-16 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
          </label>

          {error && (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-[11px] text-slate-500">
            Los IMEIs se validan con checksum Luhn. No se puede reportar un IMEI ya desbloqueado.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={16} />}
            {busy ? "Enviando..." : "Solicitar desbloqueo"}
          </button>
        </footer>
      </section>
    </div>
  );
}
