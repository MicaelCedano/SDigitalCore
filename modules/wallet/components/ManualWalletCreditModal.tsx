"use client";

import { useState } from "react";
import { Banknote, Loader2, X } from "lucide-react";
import { createManualWalletCreditAction } from "../actions/manual-credit";

type Props = { userId: string; recipientName: string };

export function ManualWalletCreditModal({ userId, recipientName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const submit = async (formData: FormData) => {
    setPending(true);
    setMessage(null);
    const result = await createManualWalletCreditAction({
      userId,
      amount: formData.get("amount"),
      reason: formData.get("reason"),
      reference: formData.get("reference"),
    });
    setPending(false);
    if (result.success) {
      setMessage(result.message ?? "Pago acreditado.");
      setAmount("");
      window.setTimeout(() => setOpen(false), 1200);
    } else setMessage(result.error ?? "No se pudo acreditar el pago manual.");
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
        <Banknote className="h-3.5 w-3.5" /> Acreditar pago
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-black text-slate-900">Acreditar pago manual</h2><p className="mt-1 text-xs text-slate-500">Destinatario: <strong>{recipientName}</strong></p></div>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form action={submit} className="mt-5 grid gap-3">
              <label className="grid gap-1 text-xs font-bold text-slate-700">Monto (RD$)<input name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej. 1600" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-700">Motivo<textarea name="reason" required minLength={10} placeholder="Ej. Compensación por revisión QC no acreditada" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-700">Referencia única<input name="reference" required pattern="[a-zA-Z0-9_-]+" placeholder="Ej. compensacion-alberto-20260831" className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /></label>
              {message ? <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-700">{message}</p> : null}
              <button type="submit" disabled={pending || !amount} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} {pending ? "Acreditando..." : amount ? `Confirmar RD$${Number(amount).toLocaleString("es-DO")}` : "Escribe el monto"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
