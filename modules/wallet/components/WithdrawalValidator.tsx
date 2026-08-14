"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { getPendingWithdrawalsAction, redeemWithdrawalAction, cancelWithdrawalAction } from "@/modules/wallet/actions/withdrawals";
import { UserAvatar } from "@/components/shared/UserAvatar";

interface PendingWithdrawal {
  id: string;
  amount: number;
  baucherCode: string;
  secureToken: string;
  technicianName: string;
  technicianUsername: string;
  technicianEmail: string;
  technicianImage: string | null;
  accountName: string;
  occurredAt: string;
}

export function WithdrawalValidator() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingWithdrawal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const money = (value: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);

  const date = (value: string) =>
    new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value));

  const load = useCallback(async () => {
    const res = await getPendingWithdrawalsAction();
    if (res.success) {
      setPending(res.data.pending);
      setError("");
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRedeem(item: PendingWithdrawal) {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await redeemWithdrawalAction({ entryId: item.id, secureToken: item.secureToken });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setNotice(`Baucher ${item.baucherCode} marcado como pagado (${money(item.amount)}).`);
    router.refresh();
    load();
  }

  async function handleCancel(item: PendingWithdrawal) {
    if (!window.confirm(`¿Anular el retiro ${item.baucherCode} de ${money(item.amount)}? Se devolverá el saldo al técnico.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const res = await cancelWithdrawalAction({ entryId: item.id });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setNotice(`Retiro ${item.baucherCode} anulado; saldo devuelto.`);
    router.refresh();
    load();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-950">
            <ShieldCheck className="h-4 w-4 text-indigo-600" /> Validador de Bauchers
          </h2>
          <p className="mt-1 text-xs text-slate-500">Retiros pendientes de canje. Verifica el token del baucher contra esta lista antes de pagar.</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        {error ? (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          </p>
        ) : null}

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No hay retiros pendientes de canje.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((item) => (
              <article key={item.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={item.technicianName} email={item.technicianEmail} src={item.technicianImage} className="h-10 w-10 rounded-xl bg-indigo-600" textClassName="text-sm" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.technicianName} {item.technicianUsername ? `@${item.technicianUsername}` : ""}</p>
                      <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{item.accountName} · {date(item.occurredAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">{money(item.amount)}</p>
                    <p className="text-[10px] font-mono font-bold text-indigo-500">{item.baucherCode}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Token de Seguridad</p>
                  <p className="break-all font-mono text-[10px] text-slate-600">{item.secureToken}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCancel(item)}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Anular
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRedeem(item)}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Marcar como Pagado
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
