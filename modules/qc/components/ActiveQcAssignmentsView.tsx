"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ClipboardList, Loader2, RefreshCw, UserRoundX } from "lucide-react";
import { cancelQcAssignmentAction, getActiveQcAssignmentsAction } from "../actions/revision-batch";

type Assignment = {
  batchId: string;
  batchNumber: string;
  supplierName: string;
  batchStatus: string;
  batchTotalDevices: number;
  batchReviewedDevices: number;
  qcId: string;
  qcName: string;
  deviceCount: number;
  reviewedDevices: number;
  latestUpdatedAt: Date;
};

export function ActiveQcAssignmentsView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getActiveQcAssignmentsAction();
    if (result.success) setAssignments(result.data as Assignment[]);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancelAssignment = async (assignment: Assignment) => {
    const key = `${assignment.batchId}:${assignment.qcId}`;
    const percent = assignment.deviceCount > 0 ? Math.round((assignment.reviewedDevices / assignment.deviceCount) * 100) : 0;
    if (!window.confirm(`¿Quitarle a ${assignment.qcName} los ${assignment.deviceCount} equipos de ${assignment.batchNumber}? Progreso de su porción: ${assignment.reviewedDevices}/${assignment.deviceCount} (${percent}%). Las inspecciones ya realizadas se conservarán.`)) return;

    setPendingKey(key);
    setError(null);
    setNotice(null);
    const result = await cancelQcAssignmentAction({ batchId: assignment.batchId, qcId: assignment.qcId });
    setPendingKey(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotice(result.message || "Asignación liberada.");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="shrink-0 rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-3 text-[#5750f1]"><ClipboardList className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Asignaciones activas de QC</h1>
            <p className="mt-0.5 text-xs text-slate-500">Porción revisada por cada QC y lote. Puedes liberar una asignación completa desde aquí.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/qc/lotes" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><ArrowLeft className="h-4 w-4" /> Volver a lotes</Link>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#463ec5] disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button>
        </div>
      </div>

      {error ? <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs" aria-label="Asignaciones activas">
        {loading ? (
          <div className="space-y-3 p-12 text-center text-slate-500"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#5750f1]" /><p className="text-xs font-semibold">Cargando asignaciones activas...</p></div>
        ) : assignments.length === 0 && !error ? (
          <div className="space-y-3 p-14 text-center text-slate-500"><ClipboardList className="mx-auto h-10 w-10 text-slate-300" /><h2 className="text-sm font-bold text-slate-800">No hay asignaciones activas</h2><p className="text-xs">Las porciones aparecerán aquí cuando se asignen equipos a un QC.</p></div>
        ) : assignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                <tr><th className="px-4 py-3.5">QC</th><th className="px-4 py-3.5">Lote</th><th className="px-4 py-3.5">Progreso de su porción</th><th className="px-4 py-3.5">Avance del lote</th><th className="px-4 py-3.5 text-center">Estado</th><th className="px-4 py-3.5 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((assignment) => {
                  const key = `${assignment.batchId}:${assignment.qcId}`;
                  const portionPercent = assignment.deviceCount > 0 ? Math.min(100, Math.round((assignment.reviewedDevices / assignment.deviceCount) * 100)) : 0;
                  const batchPercent = assignment.batchTotalDevices > 0 ? Math.min(100, Math.round((assignment.batchReviewedDevices / assignment.batchTotalDevices) * 100)) : 0;
                  return (
                    <tr key={key} className="hover:bg-slate-50/80">
                      <td className="px-4 py-4"><span className="font-bold text-slate-800">{assignment.qcName}</span><span className="mt-1 block text-[11px] text-slate-500">{assignment.deviceCount} equipos asignados</span></td>
                      <td className="px-4 py-4"><Link href={`/qc/lotes/${assignment.batchId}`} className="font-mono font-bold text-[#5750f1] hover:underline">{assignment.batchNumber}</Link><span className="mt-1 block max-w-56 truncate text-[11px] text-slate-500">{assignment.supplierName}</span></td>
                      <td className="px-4 py-4"><div className="w-48 space-y-1"><div className="flex justify-between font-bold text-slate-600"><span>{assignment.reviewedDevices}/{assignment.deviceCount} equipos</span><span>{portionPercent}%</span></div><div className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100"><div className="h-full rounded-full bg-[#5750f1] transition-all" style={{ width: `${portionPercent}%` }} /></div></div></td>
                      <td className="px-4 py-4"><div className="w-40 space-y-1"><div className="flex justify-between font-bold text-slate-600"><span>{assignment.batchReviewedDevices}/{assignment.batchTotalDevices}</span><span>{batchPercent}%</span></div><div className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${batchPercent}%` }} /></div></div></td>
                      <td className="px-4 py-4 text-center"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Activa</span></td>
                      <td className="px-4 py-4 text-right"><button onClick={() => void cancelAssignment(assignment)} disabled={pendingKey !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50">{pendingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundX className="h-3.5 w-3.5" />}{pendingKey === key ? "Liberando..." : "Quitar asignación"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <p className="text-[11px] text-slate-500">Al quitar una asignación, los equipos pendientes vuelven a la cola de QC. Las inspecciones ya guardadas se conservan y siguen contando en el lote.</p>
    </div>
  );
}
