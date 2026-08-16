"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Lock,
  Banknote,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Clock,
  ExternalLink,
  Coins,
  Sparkles,
} from "lucide-react";
import { approveRepairJobAction } from "@/modules/reparaciones/actions/repairs";

export type PendingRepairJobSummary = {
  id: string;
  jobCode: string;
  totalEquipos: number;
  montoTotal: number;
  montoPorEquipo: number;
  createdAt: Date | string;
  technician: {
    name: string | null;
    username: string | null;
  };
};

export type PendingUnlockRequestSummary = {
  id: string;
  requestCode: string;
  model: string;
  totalEquipos: number;
  montoTotalPagado: number;
  createdAt: Date | string;
  technician: {
    name: string | null;
    username: string | null;
  };
};

export type PendingWalletRedemptionSummary = {
  id: string;
  amount: number;
  description: string | null;
  createdAt: Date | string;
  wallet: {
    user: {
      name: string | null;
      username: string | null;
    };
  };
};

interface AdminTechnicianPaymentsWidgetProps {
  repairJobs: PendingRepairJobSummary[];
  unlockRequests: PendingUnlockRequestSummary[];
  walletRedemptions: PendingWalletRedemptionSummary[];
  repairPendingTotal: number;
  unlockPendingTotal: number;
  redemptionsPendingTotal: number;
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function AdminTechnicianPaymentsWidget({
  repairJobs: initialRepairJobs,
  unlockRequests,
  walletRedemptions,
  repairPendingTotal: initialRepairTotal,
  unlockPendingTotal,
  redemptionsPendingTotal,
}: AdminTechnicianPaymentsWidgetProps) {
  const [activeTab, setActiveTab] = useState<"repairs" | "unlocks" | "wallet">("repairs");
  const [repairJobs, setRepairJobs] = useState<PendingRepairJobSummary[]>(initialRepairJobs);
  const [repairPendingTotal, setRepairPendingTotal] = useState<number>(initialRepairTotal);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalAllPending =
    repairPendingTotal + unlockPendingTotal + redemptionsPendingTotal;

  async function handleQuickApprove(job: PendingRepairJobSummary) {
    if (approvingId) return;
    setApprovingId(job.id);
    setToastMessage(null);

    try {
      const res = await approveRepairJobAction({ jobId: job.id });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo aprobar el pago." });
        setApprovingId(null);
        return;
      }

      setToastMessage({
        type: "success",
        text: `¡Pago de ${job.jobCode} (RD$ ${job.montoTotal.toLocaleString("es-DO")}) aprobado y acreditado a ${job.technician.name || "técnico"}!`,
      });

      // Update state locally
      setRepairJobs((prev) => prev.filter((item) => item.id !== job.id));
      setRepairPendingTotal((prev) => Math.max(0, prev - job.montoTotal));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al aprobar el pago." });
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="enterprise-panel overflow-hidden border-[#eaecf0] shadow-sm">
      {/* Encabezado del Widget */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-gradient-to-r from-white via-[#fcfcfd] to-[#f8f9fc] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fef3f2] text-[#d92d20] shadow-xs">
            <Coins size={20} strokeWidth={2.2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#101828]">Pagos a Técnicos por Aprobar</h3>
              {repairJobs.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#fef3f2] px-2 py-0.5 text-xs font-bold text-[#b42318] ring-1 ring-inset ring-[#fee4e2]">
                  {repairJobs.length} pendiente{repairJobs.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#667085]">
              Revisión rápida de trabajos terminados y comisiones a pagar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reparaciones/pagos"
            className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] shadow-2xs transition-colors hover:bg-[#f8fafc]"
          >
            Ver módulo completo <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Tira resumen de totales */}
      <div className="grid grid-cols-3 divide-x divide-[#f0f1f3] border-b border-[#e4e7ec] bg-[#fcfcfd]">
        <button
          type="button"
          onClick={() => setActiveTab("repairs")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "repairs" ? "bg-[#fffbfa] ring-1 ring-inset ring-[#fecdca]" : "hover:bg-[#f8fafc]"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#667085]">
            <Wrench size={12} className="text-[#b42318]" /> Reparaciones
          </span>
          <span className="mt-0.5 block font-mono text-base font-bold text-[#b42318] sm:text-lg">
            RD$ {repairPendingTotal.toLocaleString("es-DO")}
          </span>
          <span className="text-[10px] text-[#667085]">{repairJobs.length} trabajo{repairJobs.length === 1 ? "" : "s"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unlocks")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "unlocks" ? "bg-[#fffcf5] ring-1 ring-inset ring-[#fedf89]" : "hover:bg-[#f8fafc]"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#667085]">
            <Lock size={12} className="text-[#b54708]" /> Desbloqueos
          </span>
          <span className="mt-0.5 block font-mono text-base font-bold text-[#b54708] sm:text-lg">
            RD$ {unlockPendingTotal.toLocaleString("es-DO")}
          </span>
          <span className="text-[10px] text-[#667085]">{unlockRequests.length} solicitud{unlockRequests.length === 1 ? "" : "es"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("wallet")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "wallet" ? "bg-[#f6fef9] ring-1 ring-inset ring-[#a6f4c5]" : "hover:bg-[#f8fafc]"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#667085]">
            <Banknote size={12} className="text-[#027a48]" /> Retiros Wallet
          </span>
          <span className="mt-0.5 block font-mono text-base font-bold text-[#027a48] sm:text-lg">
            RD$ {redemptionsPendingTotal.toLocaleString("es-DO")}
          </span>
          <span className="text-[10px] text-[#667085]">{walletRedemptions.length} baucher{walletRedemptions.length === 1 ? "" : "es"}</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between border-b px-5 py-2.5 text-xs font-medium ${
            toastMessage.type === "success"
              ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
              : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[11px] font-bold underline hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Contenido según pestaña */}
      <div className="divide-y divide-[#f0f1f3]">
        {activeTab === "repairs" && (
          <>
            {repairJobs.length > 0 ? (
              repairJobs.map((job) => {
                const isApproving = approvingId === job.id;
                return (
                  <div
                    key={job.id}
                    className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#4f46e5]">{job.jobCode}</span>
                        <span className="rounded-full bg-[#f4f3ff] px-2 py-0.5 text-[11px] font-semibold text-[#5925dc]">
                          {job.technician.name || "Técnico"} {job.technician.username ? `(@${job.technician.username})` : ""}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#667085]">
                          <Clock size={11} /> {formatDate(job.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#475467]">
                        <span className="font-semibold text-[#101828]">{job.totalEquipos} equipo{job.totalEquipos === 1 ? "" : "s"}</span> reparados a tarifa de <span className="font-medium">RD$ {job.montoPorEquipo} c/u</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-[#101828] sm:text-lg">
                          RD$ {job.montoTotal.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-[#667085]">por pagar</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickApprove(job)}
                        disabled={isApproving || Boolean(approvingId)}
                        className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#16b364] px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#079455] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Aprobar pago y acreditar al wallet del técnico de inmediato"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Aprobando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Aprobar pago
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">
                  ¡Todo al día en reparaciones!
                </p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  No hay trabajos de reparación pendientes de aprobación de pago a técnicos.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "unlocks" && (
          <>
            {unlockRequests.length > 0 ? (
              unlockRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#b54708]">{req.requestCode}</span>
                      <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-[11px] font-semibold text-[#b54708]">
                        {req.technician.name || "Técnico"} {req.technician.username ? `(@${req.technician.username})` : ""}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#667085]">
                        <Clock size={11} /> {formatDate(req.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#475467]">
                      Modelo: <span className="font-medium text-[#101828]">{req.model}</span> ({req.totalEquipos} equipo{req.totalEquipos === 1 ? "" : "s"})
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <span className="block font-mono text-base font-bold text-[#101828]">
                        RD$ {req.montoTotalPagado.toLocaleString("es-DO")}
                      </span>
                      <span className="text-[10px] font-medium text-[#667085]">por aprobar</span>
                    </div>

                    <Link
                      href="/desbloqueos/pagos"
                      className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] shadow-2xs hover:bg-[#f8fafc]"
                    >
                      Revisar en Desbloqueos <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">
                  No hay desbloqueos pendientes
                </p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Todas las solicitudes de desbloqueo han sido atendidas.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "wallet" && (
          <>
            {walletRedemptions.length > 0 ? (
              walletRedemptions.map((red) => (
                <div
                  key={red.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[11px] font-semibold text-[#027a48]">
                        {red.wallet.user.name || "Usuario"} {red.wallet.user.username ? `(@${red.wallet.user.username})` : ""}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#667085]">
                        <Clock size={11} /> {formatDate(red.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#475467]">{red.description || "Retiro de saldo en efectivo"}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <span className="block font-mono text-base font-bold text-[#101828]">
                        RD$ {red.amount.toLocaleString("es-DO")}
                      </span>
                      <span className="text-[10px] font-medium text-[#667085]">canje pendiente</span>
                    </div>

                    <Link
                      href="/wallet"
                      className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#027a48] px-3 text-xs font-semibold text-white shadow-2xs hover:bg-[#05603a]"
                    >
                      Canjear en Wallet <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">
                  No hay retiros pendientes de canje
                </p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Todos los bauchers de wallet han sido redimidos.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pie del Widget */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 sm:px-6">
        <span className="text-xs text-[#667085]">
          Total pendiente por pagar a técnicos:{" "}
          <strong className="font-mono font-bold text-[#101828]">
            RD$ {totalAllPending.toLocaleString("es-DO")}
          </strong>
        </span>
        <Link
          href="/reparaciones/pagos"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#4f46e5] hover:text-[#4338ca]"
        >
          Gestionar tarifas y pagos <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
