"use client";

import { useState } from "react";
import { Check, Clock3, Loader2, ScanSearch, X } from "lucide-react";
import { resolveImeiRequestAction } from "@/modules/qc/actions/imei-requests";

type QcRequest = {
  id: string;
  createdAt: Date | string;
  imeis: unknown;
  requester: { name: string | null; username: string | null; email: string };
};

function countImeis(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function requesterName(request: QcRequest) {
  return request.requester.name || request.requester.username || request.requester.email;
}

function dateLabel(value: Date | string) {
  return new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminQcRequestsWidget({ requests: initialRequests }: { requests: QcRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function resolve(request: QcRequest, accept: boolean) {
    if (processingId) return;
    setProcessingId(request.id);
    setFeedback(null);
    try {
      const result = await resolveImeiRequestAction({ id: request.id, accept });
      if (!result.success) throw new Error(result.error);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setFeedback({ type: "success", text: accept ? `Solicitud de ${requesterName(request)} aceptada y asignada.` : "Solicitud rechazada." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "No se pudo procesar la solicitud." });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10"><ScanSearch size={20} /></div><div><h2 className="text-base font-bold text-slate-900">Solicitudes QC de IMEIs</h2><p className="mt-0.5 text-xs text-slate-500">Acepta y asigna equipos desde el dashboard.</p></div></div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200/60">{requests.length} pendientes</span>
      </div>
      {feedback ? <p className={`border-b px-5 py-2.5 text-xs font-semibold ${feedback.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>{feedback.text}</p> : null}
      <div className="divide-y divide-slate-100">
        {requests.map((request) => {
          const busy = processingId === request.id;
          const total = countImeis(request.imeis);
          return <div key={request.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><p className="text-sm font-bold text-slate-900">{requesterName(request)}</p><p className="mt-1 text-xs text-slate-500"><span className="font-semibold text-indigo-700">{total} IMEI{total === 1 ? "" : "s"}</span> solicitados · {dateLabel(request.createdAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={!!processingId} onClick={() => void resolve(request, false)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X size={14} /> Rechazar</button><button type="button" disabled={!!processingId} onClick={() => void resolve(request, true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {busy ? "Procesando…" : "Aceptar y asignar"}</button></div></div>;
        })}
        {requests.length === 0 ? <div className="px-6 py-8 text-center"><Clock3 className="mx-auto text-slate-300" size={24} /><p className="mt-2 text-sm font-semibold text-slate-700">No hay solicitudes QC pendientes</p></div> : null}
      </div>
    </section>
  );
}
