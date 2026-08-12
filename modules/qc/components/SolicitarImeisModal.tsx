"use client";

import { useState } from "react";
import { X, Send, Loader2, AlertCircle, CheckCircle2, Scan } from "lucide-react";
import { createImeiRequestAction } from "../actions/imei-requests";

interface SolicitarImeisModalProps {
  onClose: () => void;
  onSent: () => void;
}

export function SolicitarImeisModal({ onClose, onSent }: SolicitarImeisModalProps) {
  const [imeisText, setImeisText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const imeis = imeisText
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (imeis.length === 0) {
      setError("Pega al menos un IMEI.");
      return;
    }
    setLoading(true);
    const res = await createImeiRequestAction({ imeis });
    setLoading(false);
    if (res.success) {
      setSuccess(res.message || "Solicitud enviada.");
      setImeisText("");
    } else {
      setError(res.error || "No se pudo enviar la solicitud.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Solicitar IMEIs</h2>
              <p className="text-xs text-slate-500">
                Envía los IMEIs que quieres revisar; el admin los acepta y quedan tuyos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <textarea
            rows={6}
            value={imeisText}
            onChange={(e) => setImeisText(e.target.value)}
            placeholder="Pega los IMEIs (uno por línea o separados por comas)..."
            className="w-full font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:bg-white transition-all"
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5 text-[#5750f1]" />
              Solo se aceptan IMEIs existentes y libres; el resto se omite.
            </span>
            <span className="font-bold text-[#5750f1] bg-[#5750f1]/10 px-2.5 py-0.5 rounded-full">
              {imeis.length} IMEI(s)
            </span>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
