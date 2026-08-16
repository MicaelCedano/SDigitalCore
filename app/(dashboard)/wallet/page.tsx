import { ArrowDownLeft, ArrowUpRight, Landmark, PiggyBank, WalletCards, ShieldCheck, Sparkles, Clock, History } from "lucide-react";
import { getCurrentWallet } from "@/modules/wallet/data";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { WithdrawalPanel } from "@/modules/wallet/components/WithdrawalPanel";
import { WalletAccountsSection } from "@/modules/wallet/components/WalletAccountsSection";
import { WithdrawalValidator } from "@/modules/wallet/components/WithdrawalValidator";
import { BaucherEntryButton } from "@/modules/wallet/components/BaucherEntryButton";

function money(value: string | number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value));
}

function date(value: string | Date) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value));
}

export default async function WalletPage() {
  const data = await getCurrentWallet();
  const persisted = await getPersistedCurrentUser();
  const isAdmin = persisted?.roleCode === "ADMIN";

  if (!data.schemaReady) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mi Wallet</h1>
        <p className="mt-2 text-sm text-slate-500">
          El módulo de finanzas y billetera digital estará habilitado tan pronto se aplique la migración de base de datos.
        </p>
      </div>
    );
  }

  const wallet = data.wallet;
  const principal = wallet?.accounts.find((account) => account.kind === "PRIMARY");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Sparkles size={13} />
            <span>Finanzas y Liquidaciones</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Mi Wallet</h1>
        </div>
      </header>

      {/* Hero Card Fintech */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-xl ring-1 ring-white/10">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
              <WalletCards className="h-4 w-4 text-indigo-300" />
              <span>Saldo Principal Disponible</span>
            </div>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight sm:text-4xl text-white">
              {money(wallet?.balance ?? "0")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${wallet?.status === "FROZEN" ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30" : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${wallet?.status === "FROZEN" ? "bg-rose-400" : "bg-emerald-400"}`} />
                {wallet?.status === "FROZEN" ? "Wallet Congelada" : "Billetera Activa"}
              </span>
              <span className="text-xs text-indigo-200/70">· Acreditación automática</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <span className="block text-[11px] font-semibold text-indigo-200">Titular de Cuenta</span>
            <span className="mt-0.5 block text-sm font-bold text-white">{wallet?.owner || "Usuario"}</span>
            <span className="mt-2 block text-[10px] text-indigo-300/80">SDigital Pay · DOP</span>
          </div>
        </div>
      </section>

      {/* Cuentas y Ahorros */}
      <WalletAccountsSection
        accounts={(wallet?.accounts ?? []).map((account) => ({
          id: account.id,
          name: account.name,
          kind: account.kind,
          balance: Number(account.balance),
          savingsGoal: account.savingsGoal ? Number(account.savingsGoal) : null,
        }))}
      />

      {/* Retiro de Fondos */}
      {wallet && principal ? (
        <WithdrawalPanel
          balance={Number(principal.balance)}
          ownerName={wallet.owner}
        />
      ) : null}

      {/* Validador de Retiros para Administrador */}
      {isAdmin ? <WithdrawalValidator /> : null}

      {/* Historial de Movimientos de la Wallet */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Historial de Movimientos</h2>
            <p className="mt-0.5 text-xs text-slate-500">Transacciones registradas en tiempo real.</p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-500">
            {wallet?.entries.length ?? 0} movimiento{(wallet?.entries.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>

        {!wallet || wallet.entries.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Todavía no hay movimientos registrados en esta wallet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 p-2 sm:p-3">
            {wallet.entries.map((entry) => {
              const positive = Number(entry.amount) > 0;
              const Icon = positive ? ArrowDownLeft : ArrowUpRight;
              const isWithdrawal = entry.type === "DEBIT" && entry.secureToken != null;

              return (
                <div key={entry.id} className="group flex flex-col gap-3 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60" : "bg-rose-50 text-rose-600 ring-1 ring-rose-200/60"}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {entry.description ?? entry.type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {entry.accountName} · <span className="text-slate-400">{date(entry.occurredAt)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                    {isWithdrawal && wallet ? (
                      <BaucherEntryButton
                        entry={{
                          id: entry.id,
                          description: entry.description ?? "",
                          accountName: entry.accountName,
                          amount: entry.amount,
                          occurredAt: entry.occurredAt,
                          secureToken: entry.secureToken,
                        }}
                        ownerName={wallet.owner}
                      />
                    ) : null}

                    <span className={`font-mono text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                      {positive ? `+${money(entry.amount)}` : `-${money(Math.abs(Number(entry.amount)))}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial Legacy */}
      {data.legacyHistory.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Historial del Sistema Anterior</h2>
            <p className="mt-0.5 text-xs text-slate-500">Archivo histórico de consulta (no modifica el saldo actual).</p>
          </div>
          <div className="divide-y divide-slate-100 p-2 sm:p-3">
            {data.legacyHistory.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{entry.description ?? entry.type}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {entry.occurredAt ? date(entry.occurredAt) : "Fecha no registrada"} · {entry.status ?? "Completado"}
                  </p>
                </div>
                <span className="font-mono font-bold text-slate-700">{money(entry.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
