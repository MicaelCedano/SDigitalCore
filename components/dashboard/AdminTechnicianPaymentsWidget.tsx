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
  ScanSearch,
  Check,
  Smartphone,
  User,
  ShieldCheck,
} from "lucide-react";
import { approveRepairJobAction } from "@/modules/reparaciones/actions/repairs";
import { approveUnlockRequestAction } from "@/modules/desbloqueos/actions/unlocks";
import { approveRevisionBatchAction } from "@/modules/qc/actions/revision-batch";
import { redeemWithdrawalAction } from "@/modules/wallet/actions/withdrawals";

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

export type PendingQcBatchSummary = {
  id: string;
  assignmentKey?: string;
  reviewerId?: string | null;
  reviewerName?: string | null;
  batchNumber: string;
  supplierName: string;
  status: string;
  totalDevices: number;
  reviewedDevices: number;
  createdAt: Date | string;
};

export type PendingWalletRedemptionSummary = {
  id: string;
  amount: number;
  description: string | null;
  secureToken?: string | null;
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
  qcBatches: PendingQcBatchSummary[];
  walletRedemptions: PendingWalletRedemptionSummary[];
  repairPendingTotal: number;
  unlockPendingTotal: number;
  qcSubmittedPendingTotal: number;
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

function getInitials(name: string | null) {
  if (!name) return "TC";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AdminTechnicianPaymentsWidget({
  repairJobs: initialRepairJobs,
  unlockRequests: initialUnlockRequests,
  qcBatches: initialQcBatches,
  walletRedemptions: initialWalletRedemptions,
  repairPendingTotal: initialRepairTotal,
  unlockPendingTotal: initialUnlockTotal,
  qcSubmittedPendingTotal: initialQcTotal,
  redemptionsPendingTotal: initialRedemptionsTotal,
}: AdminTechnicianPaymentsWidgetProps) {
  const [activeTab, setActiveTab] = useState<"repairs" | "unlocks" | "qc" | "wallet">(() =>
    initialQcBatches.some((batch) => batch.status === "SUBMITTED") ? "qc" : "repairs",
  );

  // Local state for immediate reactive UI
  const [repairJobs, setRepairJobs] = useState<PendingRepairJobSummary[]>(initialRepairJobs);
  const [unlockRequests, setUnlockRequests] = useState<PendingUnlockRequestSummary[]>(initialUnlockRequests);
  const [qcBatches, setQcBatches] = useState<PendingQcBatchSummary[]>(initialQcBatches);
  const [walletRedemptions, setWalletRedemptions] = useState<PendingWalletRedemptionSummary[]>(initialWalletRedemptions);

  const [repairPendingTotal, setRepairPendingTotal] = useState<number>(initialRepairTotal);
  const [unlockPendingTotal, setUnlockPendingTotal] = useState<number>(initialUnlockTotal);
  const [qcPendingTotal, setQcPendingTotal] = useState<number>(initialQcTotal);
  const [redemptionsPendingTotal, setRedemptionsPendingTotal] = useState<number>(initialRedemptionsTotal);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const submittedQcCount = qcBatches.filter((b) => b.status === "SUBMITTED").length;
  const totalAllPending =
    repairPendingTotal + unlockPendingTotal + qcPendingTotal + redemptionsPendingTotal;

  // 1. Aprobar Reparación
  async function handleApproveRepair(job: PendingRepairJobSummary) {
    if (processingId) return;
    setProcessingId(`repair-${job.id}`);
    setToastMessage(null);

    try {
      const res = await approveRepairJobAction({ jobId: job.id });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo aprobar el pago de reparación." });
        setProcessingId(null);
        return;
      }

      setToastMessage({
        type: "success",
        text: `¡Pago de ${job.jobCode} (RD$ ${job.montoTotal.toLocaleString("es-DO")}) acreditado a ${job.technician.name || "técnico"}!`,
      });

      setRepairJobs((prev) => prev.filter((item) => item.id !== job.id));
      setRepairPendingTotal((prev) => Math.max(0, prev - job.montoTotal));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al aprobar el pago." });
    } finally {
      setProcessingId(null);
    }
  }

  // 2. Aprobar Desbloqueo
  async function handleApproveUnlock(req: PendingUnlockRequestSummary) {
    if (processingId) return;
    setProcessingId(`unlock-${req.id}`);
    setToastMessage(null);

    try {
      const res = await approveUnlockRequestAction({ requestId: req.id, action: "approve" });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo aprobar la solicitud de desbloqueo." });
        setProcessingId(null);
        return;
      }

      setToastMessage({
        type: "success",
        text: `¡Desbloqueo ${req.requestCode} (RD$ ${req.montoTotalPagado.toLocaleString("es-DO")}) aprobado y acreditado a ${req.technician.name || "técnico"}!`,
      });

      setUnlockRequests((prev) => prev.filter((item) => item.id !== req.id));
      setUnlockPendingTotal((prev) => Math.max(0, prev - req.montoTotalPagado));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al procesar el desbloqueo." });
    } finally {
      setProcessingId(null);
    }
  }

  // 3. Aceptar Lote QC
  async function handleApproveQcBatch(batch: PendingQcBatchSummary) {
    if (processingId) return;
    const actionKey = batch.assignmentKey || batch.id;
    setProcessingId(`qc-${actionKey}`);
    setToastMessage(null);

    try {
      const res = await approveRevisionBatchAction({ id: batch.id, reviewerId: batch.reviewerId || undefined });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo aceptar el lote." });
        setProcessingId(null);
        return;
      }

      const payout = batch.reviewedDevices * 50;
      setToastMessage({
        type: "success",
        text: batch.reviewerId
          ? `¡Porción de ${batch.reviewerName || "QC"} aprobada! Se acreditaron RD$ ${payout.toLocaleString("es-DO")} en su wallet.`
          : `¡Lote ${batch.batchNumber} aceptado! Se acreditaron RD$ ${payout.toLocaleString("es-DO")} a los revisores.`,
      });

      setQcBatches((prev) => prev.filter((item) => (item.assignmentKey || item.id) !== actionKey));
      setQcPendingTotal((prev) => Math.max(0, prev - payout));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al aceptar el lote." });
    } finally {
      setProcessingId(null);
    }
  }

  // 4. Canjear Retiro Wallet
  async function handleRedeemWallet(red: PendingWalletRedemptionSummary) {
    if (processingId) return;
    if (!red.secureToken) {
      setToastMessage({ type: "error", text: "Requiere token manual en el módulo de Wallet." });
      return;
    }
    setProcessingId(`wallet-${red.id}`);
    setToastMessage(null);

    try {
      const res = await redeemWithdrawalAction({ entryId: red.id, secureToken: red.secureToken });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo canjear el retiro." });
        setProcessingId(null);
        return;
      }

      setToastMessage({
        type: "success",
        text: `¡Baucher canjeado! Retiro de RD$ ${red.amount.toLocaleString("es-DO")} pagado en caja a ${red.wallet.user.name || "usuario"}.`,
      });

      setWalletRedemptions((prev) => prev.filter((item) => item.id !== red.id));
      setRedemptionsPendingTotal((prev) => Math.max(0, prev - red.amount));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al canjear el retiro." });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10">
            <Coins size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Centro de Pagos y Aprobaciones</h3>
              {(repairJobs.length > 0 || unlockRequests.length > 0 || submittedQcCount > 0 || walletRedemptions.length > 0) && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200/60">
                  {repairJobs.length + unlockRequests.length + submittedQcCount + walletRedemptions.length} pendientes
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Autoriza trabajos y comisiones con acreditación inmediata.
            </p>
          </div>
        </div>

        <Link
          href="/reparaciones/pagos"
          className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:border-slate-300"
        >
          Gestión avanzada <ExternalLink size={12} />
        </Link>
      </div>

      {/* Modern Segmented Tab Bar */}
      <div className="border-b border-slate-100 bg-slate-50/60 p-3 sm:px-6">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {/* Tab 1: Reparaciones */}
          <button
            type="button"
            onClick={() => setActiveTab("repairs")}
            className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer ${
              activeTab === "repairs"
                ? "bg-white shadow-xs ring-1 ring-slate-200/80 text-slate-900"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Wrench size={13} className={activeTab === "repairs" ? "text-rose-600" : "text-slate-400"} />
              <span className="text-xs font-semibold">Reparaciones</span>
            </div>
            <span className="mt-1 font-mono text-sm font-bold tracking-tight text-slate-900">
              RD$ {repairPendingTotal.toLocaleString("es-DO")}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {repairJobs.length} trabajo{repairJobs.length === 1 ? "" : "s"}
            </span>
          </button>

          {/* Tab 2: Desbloqueos */}
          <button
            type="button"
            onClick={() => setActiveTab("unlocks")}
            className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer ${
              activeTab === "unlocks"
                ? "bg-white shadow-xs ring-1 ring-slate-200/80 text-slate-900"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Lock size={13} className={activeTab === "unlocks" ? "text-amber-600" : "text-slate-400"} />
              <span className="text-xs font-semibold">Desbloqueos</span>
            </div>
            <span className="mt-1 font-mono text-sm font-bold tracking-tight text-slate-900">
              RD$ {unlockPendingTotal.toLocaleString("es-DO")}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {unlockRequests.length} solicitud{unlockRequests.length === 1 ? "" : "es"}
            </span>
          </button>

          {/* Tab 3: Lotes QC */}
          <button
            type="button"
            onClick={() => setActiveTab("qc")}
            className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer ${
              activeTab === "qc"
                ? "bg-white shadow-xs ring-1 ring-slate-200/80 text-slate-900"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ScanSearch size={13} className={activeTab === "qc" ? "text-indigo-600" : "text-slate-400"} />
              <span className="text-xs font-semibold">Lotes QC</span>
            </div>
            <span className="mt-1 font-mono text-sm font-bold tracking-tight text-slate-900">
              RD$ {qcPendingTotal.toLocaleString("es-DO")}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {submittedQcCount} por aceptar ({qcBatches.length} tot.)
            </span>
          </button>

          {/* Tab 4: Retiros Wallet */}
          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer ${
              activeTab === "wallet"
                ? "bg-white shadow-xs ring-1 ring-slate-200/80 text-slate-900"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Banknote size={13} className={activeTab === "wallet" ? "text-emerald-600" : "text-slate-400"} />
              <span className="text-xs font-semibold">Retiros Wallet</span>
            </div>
            <span className="mt-1 font-mono text-sm font-bold tracking-tight text-slate-900">
              RD$ {redemptionsPendingTotal.toLocaleString("es-DO")}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {walletRedemptions.length} baucher{walletRedemptions.length === 1 ? "" : "es"}
            </span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between border-b px-5 py-2.5 text-xs font-medium ${
            toastMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
              : "border-rose-200 bg-rose-50/80 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className={toastMessage.type === "success" ? "text-emerald-600" : "text-rose-600"} />
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[11px] font-bold underline hover:opacity-80 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Tab Contents */}
      <div className="divide-y divide-slate-100 p-2 sm:p-3">
        {/* 1. REPARACIONES */}
        {activeTab === "repairs" && (
          <>
            {repairJobs.length > 0 ? (
              repairJobs.map((job) => {
                const isProcessing = processingId === `repair-${job.id}`;
                const initials = getInitials(job.technician.name);
                return (
                  <div
                    key={job.id}
                    className="group flex flex-col gap-3 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-xs text-indigo-700 ring-1 ring-indigo-200/60">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                            {job.jobCode}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {job.technician.name || "Técnico"}
                          </span>
                          {job.technician.username && (
                            <span className="text-[11px] text-slate-400 font-mono">@{job.technician.username}</span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock size={11} /> {formatDate(job.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          <span className="font-semibold text-slate-900">{job.totalEquipos} equipo{job.totalEquipos === 1 ? "" : "s"}</span> reparados a tarifa de <span className="font-medium text-slate-800">RD$ {job.montoPorEquipo} c/u</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-slate-900 sm:text-lg">
                          RD$ {job.montoTotal.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">por pagar</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApproveRepair(job)}
                        disabled={isProcessing || Boolean(processingId)}
                        className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                        title="Aprobar pago y acreditar al wallet"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Aprobando...
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
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <CheckCircle2 size={20} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-900">¡Todo al día en reparaciones!</p>
                <p className="mt-0.5 text-xs text-slate-500">No hay trabajos de técnicos esperando aprobación de pago.</p>
              </div>
            )}
          </>
        )}

        {/* 2. DESBLOQUEOS */}
        {activeTab === "unlocks" && (
          <>
            {unlockRequests.length > 0 ? (
              unlockRequests.map((req) => {
                const isProcessing = processingId === `unlock-${req.id}`;
                const initials = getInitials(req.technician.name);
                return (
                  <div
                    key={req.id}
                    className="group flex flex-col gap-3 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 font-bold text-xs text-amber-700 ring-1 ring-amber-200/60">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                            {req.requestCode}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {req.technician.name || "Técnico"}
                          </span>
                          {req.technician.username && (
                            <span className="text-[11px] text-slate-400 font-mono">@{req.technician.username}</span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock size={11} /> {formatDate(req.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Modelo: <span className="font-semibold text-slate-900">{req.model}</span> ({req.totalEquipos} equipo{req.totalEquipos === 1 ? "" : "s"} × RD$ 25)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-slate-900 sm:text-lg">
                          RD$ {req.montoTotalPagado.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">por pagar</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApproveUnlock(req)}
                        disabled={isProcessing || Boolean(processingId)}
                        className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                        title="Aprobar desbloqueo y acreditar pago"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Aprobando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Aprobar y Pagar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <CheckCircle2 size={20} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-900">No hay desbloqueos pendientes</p>
                <p className="mt-0.5 text-xs text-slate-500">Todas las solicitudes de desbloqueo han sido atendidas.</p>
              </div>
            )}
          </>
        )}

        {/* 3. LOTES QC */}
        {activeTab === "qc" && (
          <>
            {qcBatches.length > 0 ? (
              qcBatches.map((batch) => {
                const actionKey = batch.assignmentKey || batch.id;
                const isProcessing = processingId === `qc-${actionKey}`;
                const isSubmitted = batch.status === "SUBMITTED";
                const estimatedPayout = batch.reviewedDevices * 50;
                return (
                  <div
                    key={batch.id}
                    className="group flex flex-col gap-3 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-xs text-indigo-700 ring-1 ring-indigo-200/60">
                        QC
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                            {batch.batchNumber}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isSubmitted
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                                : batch.status === "IN_REVIEW"
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isSubmitted ? "Listo para Pagar" : batch.status === "IN_REVIEW" ? "En Revisión" : "Pendiente"}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock size={11} /> {formatDate(batch.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {batch.reviewerName ? <><span className="font-semibold text-slate-900">{batch.reviewerName}</span> · </> : null}
                          Suplidor: <span className="font-semibold text-slate-900">{batch.supplierName}</span> · Revisados:{" "}
                          <span className="font-bold text-slate-900">{batch.reviewedDevices}</span> / {batch.totalDevices} equipos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-slate-900 sm:text-lg">
                          RD$ {estimatedPayout.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {isSubmitted ? "pago revisores" : "pago estimado"}
                        </span>
                      </div>

                      {isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => handleApproveQcBatch(batch)}
                          disabled={isProcessing || Boolean(processingId)}
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                          title="Aceptar lote y pagar comisiones a revisores"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Aceptando...
                            </>
                          ) : (
                            <>
                              <Check size={14} /> Aceptar y Pagar Lote
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href={`/qc/lotes/${batch.id}`}
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300"
                        >
                          Ver lote <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <CheckCircle2 size={20} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-900">No hay lotes QC pendientes</p>
                <p className="mt-0.5 text-xs text-slate-500">Todos los lotes de revisión han sido completados y pagados.</p>
              </div>
            )}
          </>
        )}

        {/* 4. RETIROS WALLET */}
        {activeTab === "wallet" && (
          <>
            {walletRedemptions.length > 0 ? (
              walletRedemptions.map((red) => {
                const isProcessing = processingId === `wallet-${red.id}`;
                const initials = getInitials(red.wallet.user.name);
                return (
                  <div
                    key={red.id}
                    className="group flex flex-col gap-3 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-bold text-xs text-emerald-700 ring-1 ring-emerald-200/60">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {red.wallet.user.name || "Usuario"}
                          </span>
                          {red.wallet.user.username && (
                            <span className="text-[11px] text-slate-400 font-mono">@{red.wallet.user.username}</span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock size={11} /> {formatDate(red.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{red.description || "Retiro de saldo en efectivo"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-slate-900 sm:text-lg">
                          RD$ {red.amount.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">canje pendiente</span>
                      </div>

                      {red.secureToken ? (
                        <button
                          type="button"
                          onClick={() => handleRedeemWallet(red)}
                          disabled={isProcessing || Boolean(processingId)}
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                          title="Marcar retiro como pagado en efectivo"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Canjeando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} /> Canjear Retiro
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href="/wallet"
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          Validar <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <CheckCircle2 size={20} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-900">No hay retiros pendientes</p>
                <p className="mt-0.5 text-xs text-slate-500">Todos los bauchers han sido redimidos.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 sm:px-6 rounded-b-2xl">
        <span className="text-xs text-slate-500">
          Total pendiente por pagar:{" "}
          <strong className="font-mono font-bold text-slate-900">
            RD$ {totalAllPending.toLocaleString("es-DO")}
          </strong>
        </span>
        <div className="flex items-center gap-3 text-xs font-semibold text-indigo-600">
          <Link href="/reparaciones/pagos" className="hover:text-indigo-800 transition-colors">Reparaciones</Link>
          <span className="text-slate-300">·</span>
          <Link href="/desbloqueos/pagos" className="hover:text-indigo-800 transition-colors">Desbloqueos</Link>
          <span className="text-slate-300">·</span>
          <Link href="/qc/lotes" className="hover:text-indigo-800 transition-colors">Lotes QC</Link>
          <span className="text-slate-300">·</span>
          <Link href="/wallet" className="hover:text-indigo-800 transition-colors">Wallet</Link>
        </div>
      </div>
    </div>
  );
}
