import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Package,
  Send,
  ScanSearch,
} from "lucide-react";
import { getPendingImeiRequestsAction } from "../actions/imei-requests";
import { getRevisionBatchesAction } from "../actions/revision-batch";

export async function AdminQcOverview() {
  const [batchesResult, requestsResult] = await Promise.all([
    getRevisionBatchesAction(undefined, "ALL"),
    getPendingImeiRequestsAction(),
  ]);

  const batches = batchesResult.success ? batchesResult.data : [];
  const requests = requestsResult.success ? requestsResult.data : [];
  const activeBatches = batches.filter((batch) =>
    ["PENDING_REVIEW", "IN_REVIEW", "SUBMITTED"].includes(batch.status),
  );
  const activeDevices = activeBatches.reduce(
    (total, batch) => total + (batch.totalDevices || 0),
    0,
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-3 text-[#5750f1]">
            <ScanSearch className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5750f1]">Administración</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control de Calidad</h1>
            <p className="mt-1 text-xs text-slate-500">Supervisa lotes activos y solicitudes pendientes desde un solo lugar.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/qc/lotes" className="inline-flex items-center gap-1.5 rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20">
            <Package className="h-4 w-4" /> Gestionar lotes
          </Link>
          <Link href="/qc/solicitudes" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Send className="h-4 w-4" /> Ver solicitudes
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <p className="text-xs font-semibold text-blue-700">Lotes activos</p>
          <p className="mt-1 text-3xl font-black text-blue-900">{activeBatches.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold text-amber-700">Solicitudes pendientes</p>
          <p className="mt-1 text-3xl font-black text-amber-900">{requests.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-xs font-semibold text-emerald-700">Equipos en lotes activos</p>
          <p className="mt-1 text-3xl font-black text-emerald-900">{activeDevices}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Clock3 className="h-4 w-4 text-blue-600" /> Lotes activos</h2>
            <p className="mt-1 text-xs text-slate-500">Incluye lotes pendientes, en revisión y enviados a aprobación.</p>
          </div>
          <Link href="/qc/lotes" className="text-xs font-bold text-[#5750f1] hover:underline">Ver todos</Link>
        </div>
        {activeBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500"><Inbox className="mx-auto mb-2 h-7 w-7 text-slate-300" />No hay lotes activos.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeBatches.slice(0, 12).map((batch) => (
              <Link key={batch.id} href={`/qc/lotes/${batch.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold text-slate-800">{batch.batchNumber}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{batch.supplierName} · {batch.reviewedDevices || 0}/{batch.totalDevices} revisados</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#5750f1]">Ver <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Send className="h-4 w-4 text-amber-600" /> Solicitudes pendientes</h2>
            <p className="mt-1 text-xs text-slate-500">Acepta o rechaza solicitudes; al aceptar se crea un lote de trabajo separado.</p>
          </div>
          <Link href="/qc/solicitudes" className="text-xs font-bold text-[#5750f1] hover:underline">Gestionar</Link>
        </div>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-400" />No hay solicitudes pendientes.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.slice(0, 12).map((request) => {
              const count = Array.isArray(request.imeis) ? request.imeis.length : 0;
              return (
                <Link key={request.id} href="/qc/solicitudes" className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{request.requester?.name || request.requester?.username || "QC"}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{count} IMEIs · {new Date(request.createdAt).toLocaleDateString("es-DO")}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">Revisar <ArrowRight className="h-3.5 w-3.5" /></span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
