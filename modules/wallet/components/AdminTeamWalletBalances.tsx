import { Banknote, ShieldCheck, Wrench } from "lucide-react";
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
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.walletStatus === "FROZEN" ? "bg-rose-50 text-rose-700" : row.walletStatus === null ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                  {row.walletStatus === "FROZEN" ? "CONGELADA" : row.walletStatus === null ? "SIN WALLET" : "ACTIVA"}
                </span>
                <span className="font-mono text-base font-black text-slate-900">{money(row.balance, row.currency)}</span>
                <ManualWalletCreditModal userId={row.id} recipientName={row.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
