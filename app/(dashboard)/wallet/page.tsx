import { ArrowDownLeft, ArrowUpRight, Landmark, PiggyBank, WalletCards } from "lucide-react";
import { getCurrentWallet } from "@/modules/wallet/data";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { WithdrawalPanel } from "@/modules/wallet/components/WithdrawalPanel";
import { WalletAccountsSection } from "@/modules/wallet/components/WalletAccountsSection";
import { WithdrawalValidator } from "@/modules/wallet/components/WithdrawalValidator";
import { BaucherEntryButton } from "@/modules/wallet/components/BaucherEntryButton";

function money(value: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value));
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value));
}

export default async function WalletPage() {
  const data = await getCurrentWallet();
  const persisted = await getPersistedCurrentUser();
  const isAdmin = persisted?.roleCode === "ADMIN";
  if (!data.schemaReady) {
    return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-black text-slate-950">Mi Wallet</h1><p className="mt-3 text-slate-600">El módulo está preparado y mostrará saldo RD$ 0.00 cuando se aplique la migración de base de datos.</p></div>;
  }
  const wallet = data.wallet;
  const principal = wallet?.accounts.find((account) => account.kind === "PRIMARY");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Finanzas personales</p><h1 className="mt-2 text-3xl font-black text-slate-950">Mi Wallet</h1></header>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-indigo-950 p-7 text-white shadow-xl">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-indigo-100">Saldo disponible</p><WalletCards className="h-7 w-7 text-indigo-200" /></div>
        <p className="mt-4 text-4xl font-black tracking-tight">{money(wallet?.balance ?? "0")}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">{wallet?.status === "FROZEN" ? "Wallet congelada" : "Wallet activa"}</p>
      </section>
      <WalletAccountsSection
        accounts={(wallet?.accounts ?? []).map((account) => ({
          id: account.id,
          name: account.name,
          kind: account.kind,
          balance: Number(account.balance),
          savingsGoal: account.savingsGoal ? Number(account.savingsGoal) : null,
        }))}
      />
      {wallet && principal ? (
        <WithdrawalPanel
          balance={Number(principal.balance)}
          ownerName={wallet.owner}
        />
      ) : null}
      {isAdmin ? <WithdrawalValidator /> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">Movimientos</h2><p className="mt-1 text-xs text-slate-500">El historial anterior se conserva separado y no duplica este saldo.</p></div>
        {!wallet || wallet.entries.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Todavía no hay movimientos en esta wallet.</div> : (
          <div className="divide-y divide-slate-100">{wallet.entries.map((entry) => {
            const positive = Number(entry.amount) > 0;
            const Icon = positive ? ArrowDownLeft : ArrowUpRight;
            // Retiro con token: el DEBIT se guarda con amount POSITIVO (la
            // dirección la da entry.type), así que el botón "Ver baucher"
            // depende de type==="DEBIT" + secureToken, NO del signo.
            const isWithdrawal = entry.type === "DEBIT" && entry.secureToken != null;
            return <div key={entry.id} className="flex items-center gap-4 px-5 py-4"><span className={`flex h-10 w-10 items-center justify-center rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{entry.description ?? entry.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{entry.accountName} · {date(entry.occurredAt)}</p></div>{isWithdrawal && wallet ? <BaucherEntryButton entry={{ id: entry.id, description: entry.description ?? "", accountName: entry.accountName, amount: entry.amount, occurredAt: entry.occurredAt, secureToken: entry.secureToken }} ownerName={wallet.owner} /> : null}<p className={`font-black ${positive ? "text-emerald-600" : "text-rose-600"}`}>{money(entry.amount)}</p></div>;
          })}</div>
        )}
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">Historial del sistema anterior</h2><p className="mt-1 text-xs text-slate-500">Archivo de consulta. Estos movimientos no modifican el saldo mostrado arriba.</p></div>
        {data.legacyHistory.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No hay movimientos anteriores asociados.</div> : (
          <div className="divide-y divide-slate-100">{data.legacyHistory.map((entry) => <div key={entry.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-bold text-slate-900">{entry.description ?? entry.type}</p><p className="mt-1 text-xs text-slate-500">{entry.occurredAt ? date(entry.occurredAt) : "Fecha no registrada"} · {entry.status ?? "Sin estado"}</p></div><p className="font-bold text-slate-700">{money(entry.amount)}</p></div>)}</div>
        )}
      </section>
    </div>
  );
}
