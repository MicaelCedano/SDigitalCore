"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Landmark, PiggyBank, Plus } from "lucide-react";
import { TransferModal } from "@/modules/wallet/components/TransferModal";
import { CreateAccountModal } from "@/modules/wallet/components/CreateAccountModal";

interface AccountCard {
  id: string;
  name: string;
  kind: "PRIMARY" | "SAVINGS";
  balance: number;
  savingsGoal: number | null;
}

export function WalletAccountsSection({ accounts }: { accounts: AccountCard[] }) {
  const router = useRouter();
  const [transferOpen, setTransferOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const money = (value: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-950">Mis cuentas</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            La cuenta Principal y tus ahorros se mantienen separados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-600" /> Crear cuenta de ahorro
          </button>

          {accounts.length > 1 ? (
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition active:scale-[0.98]"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Transferir
            </button>
          ) : null}

          <p className="text-xs font-semibold text-slate-400">
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"}
          </p>
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
              <article
                key={account.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                      {isSavings ? "Ahorro" : "Principal"}
                    </p>
                    <h3 className="mt-1 font-bold text-slate-950">{account.name}</h3>
                  </div>
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isSavings
                        ? "bg-amber-50 text-amber-600 ring-1 ring-amber-500/15"
                        : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/15"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-2xl font-black text-slate-950">{money(account.balance)}</p>
                {progress !== null ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                      <span>Meta {money(account.savingsGoal!)}</span>
                      <span className="font-bold text-slate-700">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <CreateAccountModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      {transferOpen ? (
        <TransferModal
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
            kind: account.kind,
            balance: account.balance,
          }))}
          onClose={() => setTransferOpen(false)}
        />
      ) : null}
    </section>
  );
}
