"use client";

import Link from "next/link";
import {
  WalletCards,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
} from "lucide-react";

interface UserWalletWidgetProps {
  data: {
    balance: number;
    recentTransactions: {
      id: string;
      amount: number;
      balanceAfter?: number;
      description: string;
      type: string;
      createdAt: Date;
    }[];
  };
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function UserWalletWidget({ data }: UserWalletWidgetProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/10">
            <WalletCards size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Mi Wallet</h3>
            <p className="text-xs text-slate-500">
              Saldo disponible por servicios completados y movimientos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/wallet"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-teal-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.98]"
          >
            Ver Mi Billetera <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna Balance */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-br from-teal-900 to-slate-900 p-6 text-white shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-200">
                Balance Disponible
              </span>
              <Coins size={20} className="text-teal-300" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight">
              RD$ {data.balance.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-teal-200/70">Fondos acumulados por reparaciones y desbloqueos</p>
          </div>

          <div className="mt-6 pt-4 border-t border-teal-800/40 flex items-center justify-between">
            <span className="text-xs text-teal-200/80">Retiros procesados por administración</span>
            <Link
              href="/wallet"
              className="text-xs font-bold text-teal-300 hover:text-white inline-flex items-center gap-1"
            >
              Historial <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* Columna Movimientos Recientes */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Últimos Movimientos en Wallet
            </h4>
            <Link
              href="/wallet"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.recentTransactions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.recentTransactions.map((tx) => {
                  const isCredit = tx.amount >= 0;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isCredit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">{tx.description}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(tx.createdAt)}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-mono text-xs font-bold ${
                            isCredit ? "text-emerald-600" : "text-slate-900"
                          }`}
                        >
                          {isCredit ? "+" : ""}RD$ {tx.amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {tx.type}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay movimientos registrados en la billetera.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
