"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { transferBetweenAccountsAction } from "@/modules/wallet/actions/transfers";

interface AccountOption {
  id: string;
  name: string;
  kind: "PRIMARY" | "SAVINGS";
  balance: number;
}

export function TransferModal({
  accounts,
  onClose,
}: {
  accounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const from = accounts.find((account) => account.id === fromId);
  const to = accounts.find((account) => account.id === toId);
  const parsed = amount === "" ? NaN : Number(amount);
  const valid =
    from && to && from.id !== to.id && Number.isFinite(parsed) && parsed > 0 && parsed <= from.balance;

  const money = (value: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);

  async function handleSubmit() {
    if (!valid || !from || !to) return;
    setError("");
    setBusy(true);
    const res = await transferBetweenAccountsAction({
      fromAccountId: from.id,
      toAccountId: to.id,
      amount: parsed,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDone(
      `Se transfirieron ${money(res.data.amount)} de "${from.name}" a "${to.name}".`
    );
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700">
              <ArrowLeftRight className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Transferir entre cuentas</h2>
              <p className="text-xs text-slate-500">Mueve dinero entre tus cuentas del wallet.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Desde</label>
            <select
              value={fromId}
              onChange={(event) => setFromId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {money(account.balance)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Hacia</label>
            <select
              value={toId}
              onChange={(event) => setToId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id} disabled={account.id === fromId}>
                  {account.name} — {money(account.balance)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Monto</label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={100}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
            />
            {from && parsed > from.balance ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Saldo insuficiente en "{from.name}" ({money(from.balance)})
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>
          ) : null}
          {done ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {done}
            </div>
          ) : null}

          {!done ? (
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!valid || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                Transferir
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-900"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
