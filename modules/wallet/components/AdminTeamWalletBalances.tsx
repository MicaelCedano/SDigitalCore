"use client";

import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronDown, ShieldCheck, Wrench } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { ManualWalletCreditModal } from "./ManualWalletCreditModal";

type WalletRow = {
  id: string;
  name: string;
  username: string | null;
  role: "QC" | "TECNICO";
  userStatus: "ACTIVE" | "INACTIVE" | "BLOCKED";
  walletStatus: "ACTIVE" | "FROZEN" | null;
  currency: string;
  balance: number;
  entries: { id: string; type: string; amount: number; description: string | null; occurredAt: string }[];
};

function money(value: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(value);
}

export function AdminTeamWalletBalances({
  rows,
  totals,
}: {
  rows: WalletRow[];
  totals: { qc: number; technicians: number; all: number };
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="border-b border-indigo-100 bg-indigo-50/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-900">Saldo de QC y técnicos</h2>
            <p className="mt-1 text-xs text-slate-500">Consulta cuánto dinero tiene actualmente cada integrante en su Wallet.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
        <SummaryCard label="Total QC" value={totals.qc} icon={<ShieldCheck className="h-4 w-4" />} tone="violet" />
        <SummaryCard label="Total técnicos" value={totals.technicians} icon={<Wrench className="h-4 w-4" />} tone="orange" />
        <SummaryCard label="Total general" value={totals.all} icon={<Banknote className="h-4 w-4" />} tone="indigo" />
      </div>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">No hay usuarios QC o técnicos registrados.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => <WalletMemberRow key={row.id} row={row} />)}
        </div>
      )}
    </section>
  );
}

function WalletMemberRow({ row }: { row: WalletRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.role === "QC" ? "bg-violet-50 text-violet-700" : "bg-orange-50 text-orange-700"}`}>
                  {row.role === "QC" ? <ShieldCheck className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{row.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {row.role === "QC" ? "Control de Calidad" : "Técnico / Taller"}
                    {row.username ? ` · @${row.username}` : ""}
                    {row.userStatus !== "ACTIVE" ? ` · ${row.userStatus}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.walletStatus === "FROZEN" ? "bg-rose-50 text-rose-700" : row.walletStatus === null ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                  {row.walletStatus === "FROZEN" ? "CONGELADA" : row.walletStatus === null ? "SIN WALLET" : "ACTIVA"}
                </span>
                <span className="font-mono text-base font-black text-slate-900">{money(row.balance, row.currency)}</span>
                <ManualWalletCreditModal userId={row.id} recipientName={row.name} />
                <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Ver historial">
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </div>
      </div>
      {open ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-bold text-slate-700">Historial de pagos y movimientos</p>
            <span className="text-[11px] text-slate-500">{row.entries.length} movimiento{row.entries.length === 1 ? "" : "s"}</span>
          </div>
          {row.entries.length === 0 ? <p className="px-4 py-5 text-xs text-slate-500">No hay movimientos registrados.</p> : row.entries.map((entry) => {
            const positive = entry.amount >= 0;
            return <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-0.5 rounded-lg p-1.5 ${positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{positive ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}</span>
                <div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{entry.description ?? entry.type}</p><p className="mt-0.5 text-[11px] text-slate-500">{new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(entry.occurredAt))}</p></div>
              </div>
              <span className={`shrink-0 font-mono text-xs font-bold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{positive ? "+" : "-"}{money(Math.abs(entry.amount), row.currency)}</span>
            </div>;
          })}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "violet" | "orange" | "indigo";
}) {
  const styles = {
    violet: "bg-violet-50 text-violet-700",
    orange: "bg-orange-50 text-orange-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${styles}`}>{icon}</span>
      </div>
      <p className="mt-3 font-mono text-xl font-black text-slate-900">{money(value)}</p>
    </div>
  );
}
