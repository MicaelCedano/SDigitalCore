"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database, Link2, ShieldCheck, UserRoundX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excludeLegacyIdentityAction, linkLegacyIdentityAction } from "@/modules/wallet/actions/legacy-migration";

type Identity = {
  id: string;
  sourceUserId: string;
  username: string;
  name: string | null;
  email: string | null;
  role: string | null;
  walletEligible: boolean;
  active: boolean;
  balance: string;
  transactionCount: number;
  accountCount: number;
  savingsAccountCount: number;
  status: string;
  method: string | null;
  coreUser: { id: string; name: string | null; username: string | null; email: string } | null;
};

type CoreUser = { id: string; name: string | null; username: string | null; email: string; roleCode: string };
type Batch = {
  id: string;
  mode: string;
  status: string;
  sourceUserCount: number;
  sourceAccountCount: number;
  sourceTransactionCount: number;
  sourceBalanceTotal: string;
  transferredUserCount: number;
  transferredBalanceTotal: string;
  createdAt: string;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("es") ?? "";
}

function money(value: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value));
}

function suggestedUser(identity: Identity, users: CoreUser[]) {
  const byEmail = identity.email ? users.find((user) => normalize(user.email) === normalize(identity.email)) : undefined;
  if (byEmail) return byEmail.id;
  return users.find((user) => normalize(user.username) === normalize(identity.username))?.id ?? "";
}

export function LegacyMigrationManager({ identities, users, batches }: { identities: Identity[]; users: CoreUser[]; batches: Batch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const initialSelections = useMemo(
    () => Object.fromEntries(identities.map((identity) => [identity.id, identity.coreUser?.id ?? suggestedUser(identity, users)])),
    [identities, users],
  );
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const pending = identities.filter((identity) => !["TRANSFERRED", "EXCLUDED"].includes(identity.status));
  const linked = identities.filter((identity) => identity.status === "LINKED_PENDING_CUTOVER").length;
  const transferred = identities.filter((identity) => identity.status === "TRANSFERRED").length;
  const totalBalance = identities.reduce((sum, identity) => sum + Number(identity.balance), 0);
  const stats: Array<[string, number, LucideIcon]> = [
    ["Usuarios importados", identities.length, Database],
    ["Pendientes de confirmar", pending.length, AlertTriangle],
    ["Enlazados para corte", linked, Link2],
    ["Saldos transferidos", transferred, CheckCircle2],
  ];

  function run(action: () => Promise<{ success: boolean; message?: string; error?: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result.success ? result.message ?? "Cambio guardado." : result.error ?? "No se pudo completar la operación.");
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Configuración</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Migración de usuarios y wallets</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Confirma qué cuenta nueva corresponde a cada usuario anterior. Para personal QC, el corte conserva por separado la cuenta Principal y cada ahorro creado.
        </p>
      </header>

      {notice ? <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{String(label)}</p><Icon className="h-5 w-5 text-indigo-600" /></div>
            <p className="mt-3 text-3xl font-black text-slate-950">{String(value)}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Control financiero:</strong> saldo fuente visible {money(totalBalance.toFixed(2))}. El historial viejo es solo consulta y nunca vuelve a sumar al saldo.
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">Mapa de identidades</h2></div>
        {identities.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Todavía no se ha importado ninguna identidad. Ejecuta primero el modo de simulación y luego el modo aplicar.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {identities.map((identity) => {
              const locked = identity.status === "TRANSFERRED" || identity.status === "EXCLUDED" || Boolean(identity.coreUser);
              return (
                <article key={identity.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_.8fr_1.3fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-950">{identity.name ?? identity.username}</p>
                      {!identity.active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Inactivo anterior</span> : null}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${identity.walletEligible ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                        {identity.walletEligible ? "Elegible para Wallet" : "Solo identidad · sin Wallet"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">@{identity.username} · {identity.email ?? "sin correo"} · {identity.role ?? "sin rol"}</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-950">{money(identity.balance)}</p>
                    <p className="text-xs text-slate-500">{identity.accountCount} cuentas ({identity.savingsAccountCount} ahorros) · {identity.transactionCount} movimientos históricos</p>
                  </div>
                  <div>
                    {identity.coreUser ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                        <strong>{identity.coreUser.name ?? identity.coreUser.username}</strong><br /><span className="text-xs">{identity.coreUser.email}</span>
                      </div>
                    ) : (
                      <select
                        aria-label={`Cuenta nueva para ${identity.username}`}
                        value={selections[identity.id] ?? ""}
                        onChange={(event) => setSelections((current) => ({ ...current, [identity.id]: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="">Seleccionar cuenta nueva</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.name ?? user.username ?? user.email} · {user.roleCode}</option>)}
                      </select>
                    )}
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{identity.status.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    {!locked ? (
                      <>
                        <Button
                          size="sm"
                          disabled={isPending || !selections[identity.id]}
                          onClick={() => run(() => linkLegacyIdentityAction({ legacyIdentityId: identity.id, coreUserId: selections[identity.id] }))}
                        ><Link2 className="mr-2 h-4 w-4" />Confirmar</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => {
                            const reason = window.prompt("Motivo de exclusión (mínimo 5 caracteres):");
                            if (reason) run(() => excludeLegacyIdentityAction({ legacyIdentityId: identity.id, reason }));
                          }}
                        ><UserRoundX className="mr-2 h-4 w-4" />Excluir</Button>
                      </>
                    ) : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Últimas ejecuciones</h2>
        <div className="mt-3 space-y-2">
          {batches.length === 0 ? <p className="text-sm text-slate-500">Sin ejecuciones registradas.</p> : batches.map((batch) => (
            <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-800">{batch.mode} · {batch.status}</span>
              <span className="text-slate-500">{batch.sourceUserCount} usuarios · {batch.sourceAccountCount} cuentas · {batch.sourceTransactionCount} movimientos · {money(batch.sourceBalanceTotal)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
