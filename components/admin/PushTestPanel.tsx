"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

export function PushTestPanel({ available }: { available: boolean }) {
  const [title, setTitle] = useState("Prueba de SDigitalCore");
  const [body, setBody] = useState("Esta es una notificación enviada por el administrador.");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/push-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "test", title, body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar.");
      setStatus(`Enviada: ${result.sent} dispositivo(s). Fallidas: ${result.failed}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo enviar la notificación.");
    } finally {
      setSending(false);
    }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-base font-bold text-slate-900">Enviar push de prueba</h2>
    <div className="mt-4 grid gap-4">
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Mensaje<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={240} required rows={3} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500" /></label>
    </div>
    <button type="submit" disabled={!available || sending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {sending ? "Enviando…" : "Enviar al usuario test"}</button>
    {status ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" role="status">{status}</p> : null}
    {!available ? <p className="mt-3 text-xs text-amber-700">Instala la APK e inicia sesión como test para registrar primero el dispositivo.</p> : null}
  </form>;
}
