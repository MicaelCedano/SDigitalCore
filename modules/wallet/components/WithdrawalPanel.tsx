"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toJpeg } from "html-to-image";
import { Loader2, Landmark, Download, CheckCircle2, AlertTriangle, X, ReceiptText } from "lucide-react";
import { requestWithdrawalAction } from "@/modules/wallet/actions/withdrawals";

interface WithdrawalResult {
  amount: number;
  requestedAmount: number;
  adjusted: boolean;
  baucherCode: string;
  secureToken: string;
  newBalance: number;
}

export function WithdrawalPanel({
  balance,
  ownerName,
}: {
  balance: number;
  ownerName: string;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WithdrawalResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const baucherRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const parsed = amount === "" ? NaN : Number(amount);
  const adjusted = Number.isFinite(parsed) ? Math.floor(parsed / 100) * 100 : 0;
  const canWithdraw = Number.isFinite(parsed) && parsed > 0 && adjusted >= 2000 && adjusted <= balance;

  async function handleConfirm() {
    setError("");
    setBusy(true);
    const res = await requestWithdrawalAction({ amount: parsed });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setResult(res.data);
    setConfirming(false);
    setAmount("");
    // Refresca los server components (saldo del topbar y de la página) sin perder el baucher
    router.refresh();
  }

  async function handleDownload() {
    if (!baucherRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(baucherRef.current, { quality: 0.95, backgroundColor: "#ffffff", style: { borderRadius: "0px" } });
      const link = document.createElement("a");
      link.download = `baucher-${result?.baucherCode ?? "pago"}.jpg`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-bold text-slate-950 flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-indigo-600" /> Sacar Baucher
        </h2>
        <p className="mt-1 text-xs text-slate-500">Retiro de efectivo desde tu cuenta Principal. Mínimo RD$ 2,000, se ajusta a múltiplo de 100.</p>
      </div>

      <div className="p-5">
        {error && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">Retiro solicitado correctamente.</p>
                <p className="mt-1 text-xs font-normal">
                  {result.adjusted
                    ? `Solicitaste RD$ ${result.requestedAmount.toLocaleString("es-DO")}, se ajustó a RD$ ${result.amount.toLocaleString("es-DO")} (múltiplo de 100).`
                    : `Se retiró RD$ ${result.amount.toLocaleString("es-DO")} de tu cuenta Principal.`}
                </p>
              </div>
            </div>

            {/* Baucher — diseño System (RMA Señal Digital) */}
            <div ref={baucherRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="pointer-events-none absolute top-0 right-0 p-6 opacity-5">
                <ReceiptText className="h-40 w-40 text-indigo-900" />
              </div>
              <div className="relative z-10 p-6">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800">Baucher de Pago</h2>
                  <p className="text-xs font-bold text-slate-400">RMA Señal Digital</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Monto Depositado</span>
                    <span className="font-mono text-xl font-black text-indigo-600">RD$ {result.amount.toLocaleString("es-DO")}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Código</span><span className="font-mono font-black text-slate-800">{result.baucherCode}</span></div>
                  <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Titular</span><span className="font-black text-slate-800">{ownerName}</span></div>
                  <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Fecha</span><span className="font-black text-slate-800">{new Date().toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium", timeStyle: "short" })}</span></div>
                  <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Estado</span><span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-600 uppercase">Pendiente de Canje</span></div>
                  <div className="flex justify-between text-sm border-t border-slate-100 pt-3"><span className="font-bold text-slate-500">Nuevo saldo Principal</span><span className="font-black text-slate-900">RD$ {result.newBalance.toLocaleString("es-DO")}</span></div>
                </div>

                <div className="mt-5 text-center">
                  <p className="mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">Token de Seguridad Unívoco</p>
                  <p className="break-all rounded-lg bg-slate-100 p-2 font-mono text-[10px] text-slate-600">{result.secureToken}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Generando..." : "Descargar baucher (JPG)"}
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Monto a retirar</span>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">RD$</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={busy}
                  className="h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 pl-12 pr-3 font-mono text-lg font-black outline-none transition focus:border-[#5750f1] focus:bg-white disabled:opacity-50"
                />
              </div>
              <span className="mt-1.5 block text-[11px] text-slate-400">
                {Number.isFinite(parsed) && parsed > 0 ? `Se retirará RD$ ${adjusted.toLocaleString("es-DO")} (múltiplo de 100).` : "Mínimo RD$ 2,000."}
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setError("");
                setConfirming(true);
              }}
              disabled={!canWithdraw || busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-6 text-sm font-bold text-white shadow-lg shadow-[#5750f1]/20 transition hover:bg-[#463ec5] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Landmark className="h-4 w-4" /> Solicitar Retiro
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirming(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Confirmar retiro</h3>
            <p className="mt-1 text-xs text-slate-500">El monto se ajusta al múltiplo de 100 hacia abajo.</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monto a retirar</p>
              <p className="mt-1 font-mono text-2xl font-black text-slate-900">
                RD$ {adjusted.toLocaleString("es-DO")}
                {adjusted !== parsed ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-700">Múltiplo de 100</span> : null}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#463ec5] disabled:opacity-50"
              >
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Confirmar retiro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
