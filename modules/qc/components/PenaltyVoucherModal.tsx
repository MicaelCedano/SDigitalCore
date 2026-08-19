"use client";

import { useEffect, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import QRCode from "qrcode";
import { CheckCircle2, Download, Loader2, QrCode, Share2, ShieldCheck, X } from "lucide-react";
import { getPenaltyVoucherAction } from "../actions/penalties";

type Penalty = {
  id: string;
  type: string;
  status: string;
  monto: number;
  motivo: string;
  deviceImei: string | null;
  deviceModel: string | null;
  createdAt: Date | string;
  technician: { name: string | null; username: string | null };
  admin: { name: string | null; username: string | null };
};

function money(value: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);
}

function personName(person: { name: string | null; username: string | null }) {
  return person.name || person.username || "Sin nombre";
}

function date(value: Date | string) {
  return new Date(value).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium", timeStyle: "short" });
}

export function PenaltyVoucherModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const voucherRef = useRef<HTMLDivElement>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPenaltyVoucherAction(penalty.id);
      if (cancelled) return;
      if (!result.success) return setError(result.error);
      setVerifyUrl(result.data.verifyUrl);
      setQrData(await QRCode.toDataURL(result.data.verifyUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" }));
    })().catch(() => setError("No se pudo generar el QR verificable."));
    return () => { cancelled = true; };
  }, [penalty.id]);

  async function imageData() {
    if (!voucherRef.current) throw new Error("Baucher no disponible.");
    return toJpeg(voucherRef.current, { quality: 0.95, backgroundColor: "#ffffff", style: { borderRadius: "0px" } });
  }

  async function download() {
    setBusy("download");
    try {
      const dataUrl = await imageData();
      const link = document.createElement("a");
      link.download = `baucher-penalidad-${penalty.id.slice(-8)}.jpg`;
      link.href = dataUrl;
      link.click();
    } finally { setBusy(null); }
  }

  async function share() {
    setBusy("share");
    try {
      const dataUrl = await imageData();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `baucher-penalidad-${penalty.id.slice(-8)}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Baucher de penalidad", text: `Penalidad verificada — ${personName(penalty.technician)}` });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
      }
    } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">Baucher de penalidad</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <div ref={voucherRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="relative z-10 p-6">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600"><ShieldCheck className="h-7 w-7" /></div>
                <h2 className="text-xl font-black text-slate-800">Baucher de Penalidad</h2>
                <p className="text-xs font-bold text-slate-400">SDigitalCore · Control de Calidad</p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monto</span><span className="font-mono text-xl font-black text-rose-600">{money(penalty.monto)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Responsable</span><span className="text-right font-black text-slate-800">{personName(penalty.technician)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Tipo</span><span className="font-black text-slate-800">{penalty.type === "INTERNAL" ? "Por IMEI" : "Externa"}</span></div>
                {penalty.deviceImei ? <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">IMEI</span><span className="font-mono text-right font-bold text-slate-800">{penalty.deviceImei}</span></div> : null}
                {penalty.deviceModel ? <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Modelo</span><span className="text-right font-bold text-slate-800">{penalty.deviceModel}</span></div> : null}
                <div className="border-t border-slate-200 pt-3"><span className="font-bold text-slate-500">Motivo</span><p className="mt-1 font-semibold text-slate-800">{penalty.motivo}</p></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Fecha</span><span className="text-right font-bold text-slate-800">{date(penalty.createdAt)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Estado</span><span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${penalty.status === "ACTIVE" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{penalty.status === "ACTIVE" ? "Activa" : "Revertida"}</span></div>
              </div>
              <div className="mt-5 flex items-center gap-4 border-t border-slate-200 pt-5">
                {qrData ? <img src={qrData} alt="QR para verificar la autenticidad de la penalidad" className="h-28 w-28" /> : <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-slate-100"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
                <div className="text-xs text-slate-500"><p className="flex items-center gap-1 font-black text-indigo-700"><QrCode className="h-3.5 w-3.5" /> Verificación oficial</p><p className="mt-1">Escanea el QR para confirmar que esta penalidad existe en SDigitalCore.</p></div>
              </div>
            </div>
          </div>
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p> : null}
          {verifyUrl ? <p className="mt-3 break-all text-center text-[10px] text-slate-400">{verifyUrl}</p> : null}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={share} disabled={Boolean(busy) || !qrData} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Compartir</button>
            <button type="button" onClick={download} disabled={Boolean(busy) || !qrData} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar JPG</button>
          </div>
        </div>
      </div>
    </div>
  );
}
