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
  AlertTriangle,
  Package,
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
  const [activeTab, setActiveTab] = useState<"repairs" | "unlocks" | "qc" | "wallet">("repairs");

  // Local states for instant responsive feedback
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
        text: `¡Pago de ${job.jobCode} (RD$ ${job.montoTotal.toLocaleString("es-DO")}) aprobado y acreditado a ${job.technician.name || "técnico"}!`,
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
      setToastMessage({ type: "error", text: "Error inesperado al aprobar el desbloqueo." });
    } finally {
      setProcessingId(null);
    }
  }

  // 3. Aceptar y Pagar Lote QC
  async function handleApproveQcBatch(batch: PendingQcBatchSummary) {
    if (processingId) return;
    setProcessingId(`qc-${batch.id}`);
    setToastMessage(null);

    try {
      const res = await approveRevisionBatchAction({ id: batch.id });
      if (!res.success) {
        setToastMessage({ type: "error", text: res.error || "No se pudo aceptar el lote de revisión." });
        setProcessingId(null);
        return;
      }

      const payout = batch.reviewedDevices * 50;
      setToastMessage({
        type: "success",
        text: `¡Lote ${batch.batchNumber} aceptado! Se pagaron RD$ ${payout.toLocaleString("es-DO")} a los revisores de QC.`,
      });

      setQcBatches((prev) => prev.filter((item) => item.id !== batch.id));
      setQcPendingTotal((prev) => Math.max(0, prev - payout));
    } catch {
      setToastMessage({ type: "error", text: "Error inesperado al aceptar el lote de revisión." });
    } finally {
      setProcessingId(null);
    }
  }

  // 4. Canjear Retiro de Wallet
  async function handleRedeemWallet(red: PendingWalletRedemptionSummary) {
    if (processingId) return;
    if (!red.secureToken) {
      setToastMessage({ type: "error", text: "Este retiro requiere validación manual con token en el módulo Wallet." });
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
        text: `¡Baucher canjeado! Retiro de RD$ ${red.amount.toLocaleString("es-DO")} pagado en efectivo a ${red.wallet.user.name || "usuario"}.`,
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
    <div className="enterprise-panel overflow-hidden border-[#eaecf0] shadow-sm">
      {/* Encabezado del Widget */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-gradient-to-r from-white via-[#fcfcfd] to-[#f8f9fc] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fef3f2] text-[#d92d20] shadow-xs">
            <Coins size={20} strokeWidth={2.2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#101828]">Aprobación de Pagos y Lotes</h3>
              {(repairJobs.length > 0 || unlockRequests.length > 0 || submittedQcCount > 0 || walletRedemptions.length > 0) && (
                <span className="inline-flex items-center rounded-full bg-[#fef3f2] px-2 py-0.5 text-xs font-bold text-[#b42318] ring-1 ring-inset ring-[#fee4e2]">
                  {repairJobs.length + unlockRequests.length + submittedQcCount + walletRedemptions.length} pendientes
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#667085]">
              Aprueba reparaciones, desbloqueos, lotes QC y retiros de wallet en 1 clic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reparaciones/pagos"
            className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] shadow-2xs transition-colors hover:bg-[#f8fafc]"
          >
            Módulos de pago <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Tira resumen de pestañas interactivas */}
      <div className="grid grid-cols-2 divide-x divide-[#f0f1f3] border-b border-[#e4e7ec] bg-[#fcfcfd] sm:grid-cols-4">
        {/* Pestaña Reparaciones */}
        <button
          type="button"
          onClick={() => setActiveTab("repairs")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "repairs" ? "bg-[#fffbfa] ring-2 ring-inset ring-[#fecdca]" : "hover:bg-[#f8fafc]"
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

        {/* Pestaña Desbloqueos */}
        <button
          type="button"
          onClick={() => setActiveTab("unlocks")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "unlocks" ? "bg-[#fffcf5] ring-2 ring-inset ring-[#fedf89]" : "hover:bg-[#f8fafc]"
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

        {/* Pestaña Lotes QC */}
        <button
          type="button"
          onClick={() => setActiveTab("qc")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "qc" ? "bg-[#eef2ff] ring-2 ring-inset ring-[#c7d2fe]" : "hover:bg-[#f8fafc]"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#667085]">
            <ScanSearch size={12} className="text-[#4f46e5]" /> Lotes QC
          </span>
          <span className="mt-0.5 block font-mono text-base font-bold text-[#4f46e5] sm:text-lg">
            RD$ {qcPendingTotal.toLocaleString("es-DO")}
          </span>
          <span className="text-[10px] text-[#667085]">{submittedQcCount} por aceptar ({qcBatches.length} tot.)</span>
        </button>

        {/* Pestaña Retiros Wallet */}
        <button
          type="button"
          onClick={() => setActiveTab("wallet")}
          className={`p-3 text-center transition-colors sm:px-4 ${
            activeTab === "wallet" ? "bg-[#f6fef9] ring-2 ring-inset ring-[#a6f4c5]" : "hover:bg-[#f8fafc]"
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
        {/* 1. REPARACIONES */}
        {activeTab === "repairs" && (
          <>
            {repairJobs.length > 0 ? (
              repairJobs.map((job) => {
                const isProcessing = processingId === `repair-${job.id}`;
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
                        onClick={() => handleApproveRepair(job)}
                        disabled={isProcessing || Boolean(processingId)}
                        className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#16b364] px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#079455] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Aprobar pago y acreditar al wallet del técnico de inmediato"
                      >
                        {isProcessing ? (
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
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">¡Todo al día en reparaciones!</p>
                <p className="mt-0.5 text-xs text-[#667085]">No hay trabajos de reparación pendientes de aprobación.</p>
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
                return (
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
                        Modelo: <span className="font-semibold text-[#101828]">{req.model}</span> ({req.totalEquipos} equipo{req.totalEquipos === 1 ? "" : "s"} × RD$ 25 c/u)
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-[#101828] sm:text-lg">
                          RD$ {req.montoTotalPagado.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-[#667085]">por pagar</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApproveUnlock(req)}
                        disabled={isProcessing || Boolean(processingId)}
                        className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#16b364] px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#079455] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Aprobar desbloqueo y pagar comisiones al técnico"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Aprobando...
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
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">No hay desbloqueos pendientes</p>
                <p className="mt-0.5 text-xs text-[#667085]">Todas las solicitudes de desbloqueo han sido atendidas.</p>
              </div>
            )}
          </>
        )}

        {/* 3. LOTES QC */}
        {activeTab === "qc" && (
          <>
            {qcBatches.length > 0 ? (
              qcBatches.map((batch) => {
                const isProcessing = processingId === `qc-${batch.id}`;
                const isSubmitted = batch.status === "SUBMITTED";
                const estimatedPayout = batch.reviewedDevices * 50;
                return (
                  <div
                    key={batch.id}
                    className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#4f46e5]">{batch.batchNumber}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            isSubmitted
                              ? "bg-[#ecfdf3] text-[#027a48]"
                              : batch.status === "IN_REVIEW"
                              ? "bg-[#eef2ff] text-[#4f46e5]"
                              : "bg-[#f8fafc] text-[#475467]"
                          }`}
                        >
                          {isSubmitted ? "ENVIADO (Listo para Pagar)" : batch.status === "IN_REVIEW" ? "EN REVISIÓN" : "PENDIENTE"}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#667085]">
                          <Clock size={11} /> {formatDate(batch.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#475467]">
                        Suplidor: <span className="font-semibold text-[#101828]">{batch.supplierName}</span> · Revisados:{" "}
                        <span className="font-bold text-[#101828]">{batch.reviewedDevices}</span> / {batch.totalDevices} equipos
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <span className="block font-mono text-base font-bold text-[#101828] sm:text-lg">
                          RD$ {estimatedPayout.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-[#667085]">
                          {isSubmitted ? "pago a revisores" : "pago estimado"}
                        </span>
                      </div>

                      {isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => handleApproveQcBatch(batch)}
                          disabled={isProcessing || Boolean(processingId)}
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#4f46e5] px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#4338ca] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                          title="Aceptar lote y pagar RD$50 por equipo revisado a los técnicos de QC"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Aceptando...
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
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] shadow-2xs hover:bg-[#f8fafc]"
                        >
                          Ver lote en QC <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">No hay lotes QC pendientes de revisión o pago</p>
                <p className="mt-0.5 text-xs text-[#667085]">Todos los lotes de compra están completados y pagados.</p>
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
                return (
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
                        <span className="block font-mono text-base font-bold text-[#101828] sm:text-lg">
                          RD$ {red.amount.toLocaleString("es-DO")}
                        </span>
                        <span className="text-[10px] font-medium text-[#667085]">canje pendiente</span>
                      </div>

                      {red.secureToken ? (
                        <button
                          type="button"
                          onClick={() => handleRedeemWallet(red)}
                          disabled={isProcessing || Boolean(processingId)}
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#027a48] px-3.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#05603a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                          title="Marcar retiro como pagado en efectivo"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Canjeando...
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
                          className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#027a48] px-3 text-xs font-semibold text-white shadow-2xs hover:bg-[#05603a]"
                        >
                          Validar en Wallet <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-9 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-[#101828]">No hay retiros pendientes de canje</p>
                <p className="mt-0.5 text-xs text-[#667085]">Todos los bauchers de wallet han sido redimidos.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pie del Widget */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 sm:px-6">
        <span className="text-xs text-[#667085]">
          Total pendiente por pagar en el sistema:{" "}
          <strong className="font-mono font-bold text-[#101828]">
            RD$ {totalAllPending.toLocaleString("es-DO")}
          </strong>
        </span>
        <div className="flex items-center gap-3 text-xs font-bold text-[#4f46e5]">
          <Link href="/reparaciones/pagos" className="hover:underline">Reparaciones</Link>
          <span>·</span>
          <Link href="/desbloqueos/pagos" className="hover:underline">Desbloqueos</Link>
          <span>·</span>
          <Link href="/qc/lotes" className="hover:underline">Lotes QC</Link>
          <span>·</span>
          <Link href="/wallet" className="hover:underline">Wallet</Link>
        </div>
      </div>
    </div>
  );
}
