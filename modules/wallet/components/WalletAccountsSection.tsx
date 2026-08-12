"use client";

import { useState } from "react";
import { ArrowLeftRight, Landmark, PiggyBank } from "lucide-react";
import { TransferModal } from "@/modules/wallet/components/TransferModal";

interface AccountCard {
  id: string;
  name: string;
  kind: "PRIMARY" | "SAVINGS";
  balance: number;
  savingsGoal: number | null;
}

export function WalletAccountsSection({ accounts }: { accounts: AccountCard[] }) {
  const [open, setOpen] = useState(false);
  const money = (value: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-950">Mis cuentas</h2>
          <p className="mt-1 text-xs text-slate-500">La cuenta Principal y tus ahorros se mantienen separados.</p>
        </div>
        <div className="flex items-center gap-3">
          {accounts.length > 1 ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
            >
              <ArrowLeftRight className="h-4 w-4" /> Transferir
            </button>
          ) : null}
          <p className="text-xs font-semibold text-slate-500">{accounts.length} cuentas</p>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Todavía no hay cuentas asociadas.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const isSavings = account.kind === "SAVINGS";
            const progress =
              account.savingsGoal && account.savingsGoal > 0
                ? Math.min(100, Math.max(0, (account.balance / account.savingsGoal) * 100))
                : null;
            const Icon = isSavings ? PiggyBank : Landmark;
            return (
              <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                      {isSavings ? "Ahorro" : "Principal"}
                    </p>
                    <h3 className="mt-1 font-bold text-slate-950">{account.name}</h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-2xl font-black text-slate-950">{money(account.balance)}</p>
                {progress !== null ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                      <span>Meta {money(account.savingsGoal!)}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {open ? (
        <TransferModal
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
            kind: account.kind,
            balance: account.balance,
          }))}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}
