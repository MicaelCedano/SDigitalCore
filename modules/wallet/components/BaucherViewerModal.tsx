"use client";

import { useEffect, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { Loader2, Download, Share2, X, ReceiptText, CheckCircle2 } from "lucide-react";
import { getWalletBreakdownAction } from "@/modules/wallet/actions/withdrawals";
import { BaucherBreakdown, type WalletBreakdown } from "@/modules/wallet/components/BaucherBreakdown";

interface BaucherEntry {
  id: string;
  description: string;
  accountName: string;
  amount: string;
  occurredAt: string;
  secureToken: string | null;
  ownerName: string;
}

function money(value: string | number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value));
}

export function BaucherViewerModal({ entry, onClose }: { entry: BaucherEntry; onClose: () => void }) {
  const baucherRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [breakdown, setBreakdown] = useState<WalletBreakdown | null>(null);

  // Desglose por concepto (por qué se paga ese dinero) — por usuario, no por entry
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getWalletBreakdownAction();
      if (!cancelled && res.success) setBreakdown(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const baucherCode = entry.description?.replace("Retiro de efectivo ", "") ?? `B-${entry.id.slice(-6).toUpperCase()}`;
  const amount = Number(entry.amount);

  async function handleDownload() {
    if (!baucherRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(baucherRef.current, { quality: 0.95, backgroundColor: "#ffffff", style: { borderRadius: "0px" } });
      const link = document.createElement("a");
      link.download = `baucher-${baucherCode}.jpg`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    if (!baucherRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toJpeg(baucherRef.current, { quality: 0.95, backgroundColor: "#ffffff", style: { borderRadius: "0px" } });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `baucher-${baucherCode}.jpg`, { type: "image/jpeg" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Baucher de Pago",
          text: `Baucher de pago por ${money(amount)} — ${baucherCode}`,
        });
      } else {
        const link = document.createElement("a");
        link.download = `baucher-${baucherCode}.jpg`;
        link.href = dataUrl;
        link.click();
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">Baucher de Pago</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {/* Baucher — diseño System */}
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
                  <span className="font-mono text-xl font-black text-indigo-600">{money(amount)}</span>
                </div>
                <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Código</span><span className="font-mono font-black text-slate-800">{baucherCode}</span></div>
                <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Titular</span><span className="font-black text-slate-800">{entry.ownerName}</span></div>
                <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Fecha</span><span className="font-black text-slate-800">{new Date(entry.occurredAt).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium", timeStyle: "short" })}</span></div>
                <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Estado</span><span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-600 uppercase">Pendiente de Canje</span></div>
              </div>

              {breakdown ? (
                <BaucherBreakdown breakdown={breakdown} />
              ) : (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-[10px] font-bold text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando desglose...
                </div>
              )}

              <div className="mt-5 text-center">
                <p className="mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">Token de Seguridad Unívoco</p>
                <p className="break-all rounded-lg bg-slate-100 p-2 font-mono text-[10px] text-slate-600">{entry.secureToken ?? "No disponible"}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Compartir
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar (JPG)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
