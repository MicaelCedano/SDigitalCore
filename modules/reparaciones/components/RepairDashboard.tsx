"use client";

import { useState } from "react";
import {
  Loader2,
  Wrench,
  Inbox,
  Clock,
  Coins,
  Wallet,
  UserCheck,
  BadgeCheck,
  Plus,
  RefreshCw,
  Smartphone,
  CircleDollarSign,
} from "lucide-react";
import { getRepairDashboardAction, reportRepairWorkAction } from "@/modules/reparaciones/actions/repairs";
import { ReportRepairWorkModal } from "@/modules/reparaciones/components/ReportRepairWorkModal";

interface RepairDashboardProps {
  initialData: any;
}

export function RepairDashboard({ initialData }: RepairDashboardProps) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [prefilled, setPrefilled] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p className="text-xs font-semibold">No se pudo cargar el panel de Reparaciones.</p>
      </div>
    );
  }

  const refresh = async () => {
    setRefreshing(true);
    setMessage("");
    const res = await getRepairDashboardAction();
    if (res.success && res.data.data) setData(res.data.data);
    else if (res.success && res.data.isAdmin) setData(null);
    else setMessage("No se pudo actualizar el panel.");
    setRefreshing(false);
  };

  const { queue, myJobs, stats } = data;

  async function handleReport(values: { observaciones?: string; items: any[] }) {
    setMessage("");
    const res = await reportRepairWorkAction(values);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return false;
    }
    setMessageTone("ok");
    setMessage(`Trabajo ${(res as any).jobCode} reportado. Pendiente de aprobación y pago.`);
    await refresh();
    return true;
  }

  const jobStatusBadge = (status: string) =>
    status === "PAID" ? (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">PAGADO</span>
    ) : status === "CANCELLED" ? (
      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">CANCELADO</span>
    ) : (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">PENDIENTE DE PAGO</span>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Panel de Reparaciones</h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5 text-[#5750f1]" />
              Cola de garantías asignadas y trabajos reportados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setPrefilled(null);
              setReportOpen(true);
            }}
            className="px-4 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Reportar trabajo
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-xl border p-4 text-sm font-medium ${
            messageTone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">En Cola</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{stats.enCola}</span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Trabajos Pendientes</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-600">{stats.trabajosPendientes}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Equipos Pendientes de Pago</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{stats.pendienteEquipos}</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Total Pagado</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">
              RD$ {stats.totalPagado.toLocaleString("es-DO")}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Saldo del Wallet</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#5750f1]">
              RD$ {stats.saldoWallet.toLocaleString("es-DO")}
            </span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Cola de reparaciones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#5750f1]" /> Cola de Reparaciones
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            {queue.length} caso(s) asignado(s) desde garantías
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">No tienes casos en la cola</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Cuando el administrador envíe garantías a reparaciones desde el módulo de garantías,
              aparecerán aquí automáticamente para que las repares.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Caso</th>
                    <th className="px-4 py-3.5">IMEI</th>
                    <th className="px-4 py-3.5">Equipo</th>
                    <th className="px-4 py-3.5">Cliente</th>
                    <th className="px-4 py-3.5">Falla</th>
                    <th className="px-4 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.map((caseItem: any) => (
                    <tr key={caseItem.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-[#5750f1]">{caseItem.caseCode}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-800">{caseItem.imei}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">{caseItem.model}</td>
                      <td className="px-4 py-3.5 text-slate-600">{caseItem.clientName}</td>
                      <td className="px-4 py-3.5 text-slate-500 max-w-[240px] truncate" title={caseItem.problem}>
                        {caseItem.problem}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setPrefilled({
                              imei: caseItem.imei,
                              modelo: caseItem.model,
                              problema: caseItem.problem,
                              cliente: caseItem.clientName,
                              warrantyCaseId: caseItem.id,
                            });
                            setReportOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#5750f1]/10 text-[#5750f1] rounded-xl text-[11px] font-bold hover:bg-[#5750f1]/20 transition-colors"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" /> Reportar reparado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mis trabajos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 text-[#5750f1]" /> Mis Trabajos Reportados
          </h2>
          <span className="text-[11px] font-bold text-slate-400">{myJobs.length} trabajo(s)</span>
        </div>

        {myJobs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
            <Wrench className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">Aún no has reportado trabajos</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Usa "Reportar trabajo" para reportar equipos reparados (de tu cola o IMEIs sueltos).
              Al aprobarse, se te paga RD$ por equipo al wallet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {myJobs.map((job: any) => (
              <div key={job.id} className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#5750f1]">{job.jobCode}</span>
                  {jobStatusBadge(job.status)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Smartphone className="w-3.5 h-3.5" />
                  {job.totalEquipos} equipo(s)
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{job.items.map((i: any) => i.imei).join(", ")}</span>
                </div>
                {job.observaciones && (
                  <p className="text-[11px] text-slate-500 italic line-clamp-2">"{job.observaciones}"</p>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {job.status === "PAID" ? "Pagado" : "Total estimado"}
                  </span>
                  <span className={`text-sm font-bold ${job.status === "PAID" ? "text-emerald-600" : "text-slate-800"}`}>
                    RD$ {Number(job.montoTotal).toLocaleString("es-DO")}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {new Date(job.createdAt).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Santo_Domingo",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {reportOpen && (
        <ReportRepairWorkModal
          prefilled={prefilled}
          onClose={() => {
            setReportOpen(false);
            setPrefilled(null);
          }}
          onSubmit={handleReport}
        />
      )}
    </div>
  );
}
