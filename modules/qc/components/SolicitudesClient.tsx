"use client";

import { useState, useEffect } from "react";
import {
  Send,
  RefreshCw,
  Inbox,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
} from "lucide-react";
import {
  getPendingImeiRequestsAction,
  resolveImeiRequestAction,
} from "../actions/imei-requests";

export function SolicitudesClient() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await getPendingImeiRequestsAction();
    if (res.success) setRequests(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const resolve = async (id: string, accept: boolean) => {
    setProcessingId(id);
    setError(null);
    const res = await resolveImeiRequestAction({ id, accept });
    setProcessingId(null);
    if (res.success) {
      fetchRequests();
    } else {
      setError(res.error || "No se pudo procesar la solicitud.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Solicitudes de IMEIs</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Los de control de calidad te envían los IMEIs que quieren revisar; al aceptar,
              quedan asignados a ellos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          title="Recargar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
          <p className="text-xs font-semibold">Cargando solicitudes...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
          <Inbox className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No hay solicitudes pendientes</h3>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            Cuando un QC envíe IMEIs desde su panel, aparecerán aquí para que los aceptes o rechaces.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {req.requester?.name || req.requester?.username || "QC"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(req.createdAt).toLocaleString("es-DO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {(Array.isArray(req.imeis) ? req.imeis.length : 0)} IMEI(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(req.id, false)}
                    disabled={processingId === req.id}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-600 hover:text-white transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(req.id, true)}
                    disabled={processingId === req.id}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Aceptar y Asignar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {(Array.isArray(req.imeis) ? req.imeis : []).map((imei: any, idx: number) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <p className="font-mono font-bold text-slate-800 text-[11px]">{imei.imei}</p>
                    <p className="text-[10px] text-slate-500 truncate">{imei.model || "—"}</p>
                    <p className="text-[10px] font-bold mt-0.5">
                      {imei.currentAssignedToId ? (
                        <span className="text-amber-600">Ya asignado</span>
                      ) : (
                        <span className="text-emerald-600">Disponible</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
