"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, X } from "lucide-react";
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
  const [cancelTarget, setCancelTarget] = useState<PendingWithdrawal | null>(null);

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
    setCancelTarget(item);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const item = cancelTarget;
    setCancelTarget(null);
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

      <WithdrawalCancelModal
        item={cancelTarget}
        loading={busy}
        money={money}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
      />
    </section>
  );
}

function WithdrawalCancelModal({
  item,
  loading,
  money,
  onCancel,
  onConfirm,
}: {
  item: PendingWithdrawal | null;
  loading: boolean;
  money: (value: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cancel-withdrawal-title" aria-describedby="cancel-withdrawal-description">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 pb-4 pt-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="cancel-withdrawal-title" className="text-lg font-black text-slate-900">¿Anular retiro?</h2>
              <p id="cancel-withdrawal-description" className="mt-1 text-sm leading-relaxed text-slate-500">Esta acción devolverá el saldo al técnico y el baucher dejará de estar disponible para pago.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2 px-6 py-5">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Baucher</span>
            <span className="font-mono text-sm font-black text-slate-800">{item.baucherCode}</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-slate-500">Monto a devolver</span>
            <span className="text-base font-black text-slate-900">{money(item.amount)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {loading ? "Anulando…" : "Anular retiro"}
          </button>
        </div>
      </div>
    </div>
  );
}
