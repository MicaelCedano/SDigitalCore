"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, PackageCheck, Search, ShieldAlert } from "lucide-react";
import { markWarrantyReadyByImei } from "@/modules/garantias/actions/warranty";

type ReadyResult = { caseCode: string; clientName: string; model: string };

export function ReadyForCustomerForm() {
  const [imei, setImei] = useState("");
  const [result, setResult] = useState<ReadyResult | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setResult(null);
    const response = await markWarrantyReadyByImei({ imei });
    setBusy(false);
    if (!response.success) {
      setMessage({ type: "error", text: response.error });
      setImei("");
      inputRef.current?.focus();
      return;
    }
    setResult(response.data);
    setMessage({ type: "success", text: "Equipo marcado como listo para entregar al cliente." });
    setImei("");
    inputRef.current?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Acceso rápido · Garantías</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Listos para entregar al cliente</h1>
        <p className="mt-2 text-sm text-slate-500">Escribe o escanea únicamente el IMEI de un equipo reparado.</p>
      </header>

      <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <span className="rounded-xl bg-white p-3 text-emerald-600 shadow-sm"><PackageCheck size={24} /></span>
          <div>
            <h2 className="font-bold text-emerald-950">Marcar equipo reparado</h2>
            <p className="mt-1 text-sm text-emerald-800">El sistema solo aceptará equipos recibidos como reparados del técnico o del suplidor.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm font-bold text-slate-700" htmlFor="ready-imei">IMEI del equipo</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={inputRef}
              id="ready-imei"
              value={imei}
              onChange={(event) => setImei(event.target.value.replace(/\D/g, "").slice(0, 15))}
              inputMode="numeric"
              pattern="[0-9]{15}"
              autoComplete="off"
              autoFocus
              placeholder="Escribe o escanea los 15 dígitos"
              className="h-14 w-full rounded-2xl border border-slate-300 pl-12 pr-4 text-lg font-bold tracking-[0.12em] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              required
            />
          </div>
          <button type="submit" disabled={busy || imei.length !== 15} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <PackageCheck size={18} /> {busy ? "Verificando…" : "Marcar listo para entregar"}
          </button>
        </form>

        {message && (
          <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`} role="status">
            {message.type === "success" ? <CheckCircle2 size={20} className="shrink-0" /> : <ShieldAlert size={20} className="shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-900">{result.caseCode}</p>
            <p className="mt-1">{result.clientName} · {result.model}</p>
          </div>
        )}
      </section>
    </main>
  );
}
