"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Scan,
  Check,
  Ban,
  UserX,
  History,
} from "lucide-react";
import { createImeiRequestAction, validateImeisAction } from "../actions/imei-requests";

type ImeiStatus = "ok" | "not_found" | "assigned" | "reviewed";

const STATUS_CFG: Record<ImeiStatus, { label: string; cls: string; Icon: typeof Check }> = {
  ok: {
    label: "Disponible",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Icon: Check,
  },
  not_found: {
    label: "No existe",
    cls: "text-red-700 bg-red-50 border-red-200",
    Icon: Ban,
  },
  assigned: {
    label: "Asignado a otro QC",
    cls: "text-amber-700 bg-amber-50 border-amber-200",
    Icon: UserX,
  },
  reviewed: {
    label: "Ya revisado",
    cls: "text-[#475467] bg-[#f2f4f7] border-[#e4e7ec]",
    Icon: History,
  },
};

interface SolicitarImeisModalProps {
  onClose: () => void;
  onSent: () => void;
}

export function SolicitarImeisModal({ onClose, onSent }: SolicitarImeisModalProps) {
  const [imeisText, setImeisText] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validation, setValidation] = useState<Record<string, ImeiStatus> | null>(null);

  const imeis = useMemo(
    () =>
      Array.from(
        new Set(
          imeisText
            .split(/[\r\n,;\t]+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 4)
        )
      ),
    [imeisText]
  );

  // Validación en vivo (debounced): al pegar, cada IMEI se clasifica al instante.
  useEffect(() => {
    if (imeis.length === 0) {
      setValidation(null);
      setValidating(false);
      return;
    }
    setValidation(null);
    setValidating(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await validateImeisAction({ imeis });
        if (cancelled) return;
        if (res.success && res.data) {
          const map: Record<string, ImeiStatus> = {};
          for (const item of res.data) map[item.imei] = item.status;
          setValidation(map);
        } else {
          setError(res.error || "No se pudieron validar los IMEIs.");
          setValidation(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[qc] Error al validar IMEIs:", err);
        setError("No se pudo conectar con el servidor al validar. Intenta de nuevo.");
        setValidation(null);
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imeis]);

  const counts = useMemo(() => {
    const c = { ok: 0, not_found: 0, assigned: 0, reviewed: 0 };
    if (!validation) return c;
    for (const imei of imeis) {
      const st = validation[imei];
      if (st) c[st] += 1;
    }
    return c;
  }, [validation, imeis]);

  const summary = validating
    ? "Validando..."
    : validation
    ? `${counts.ok} de ${imeis.length} disponibles` +
      (counts.not_found > 0 ? ` · ${counts.not_found} no existen` : "") +
      (counts.assigned > 0 ? ` · ${counts.assigned} asignados a otro QC` : "") +
      (counts.reviewed > 0 ? ` · ${counts.reviewed} ya revisados` : "")
    : "Solo se aceptan IMEIs existentes, libres y sin revisar; el resto se omite.";

  const submit = async () => {
    setError(null);
    setSuccess(null);
    const toSend = validation ? imeis.filter((i) => validation[i] === "ok") : imeis;
    if (toSend.length === 0) {
      setError(
        validation
          ? "Ninguno de los IMEIs está disponible para solicitar."
          : "Pega al menos un IMEI."
      );
      return;
    }
    setLoading(true);
    const res = await createImeiRequestAction({ imeis: toSend });
    setLoading(false);
    if (res.success) {
      setSuccess(res.message || "Solicitud enviada.");
      setImeisText("");
      setValidation(null);
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

          {validation && imeis.length > 0 && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {imeis.map((imei) => {
                const st = validation[imei];
                if (!st) return null;
                const cfg = STATUS_CFG[st];
                const Icon = cfg.Icon;
                return (
                  <div key={imei} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-700 truncate">
                      {imei}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${cfg.cls}`}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 min-w-0">
              {validating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5750f1] shrink-0" />
              ) : (
                <Scan className="w-3.5 h-3.5 text-[#5750f1] shrink-0" />
              )}
              <span className="truncate">{summary}</span>
            </span>
            <span className="font-bold text-[#5750f1] bg-[#5750f1]/10 px-2.5 py-0.5 rounded-full shrink-0">
              {validation ? `${counts.ok}/${imeis.length} disponibles` : `${imeis.length} IMEI(s)`}
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
