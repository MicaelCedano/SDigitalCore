"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Wallet,
  Package,
  User,
  FileText,
  Save,
  Coins,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  approveRepairJobAction,
  getPendingRepairJobsAction,
  getTechnicianRepairRatesAction,
  saveTechnicianRepairRateAction,
} from "@/modules/reparaciones/actions/repairs";

export function PendingRepairApproval({ initialJobs, initialRates }: { initialJobs: any[]; initialRates: any[] }) {
  const [jobs, setJobs] = useState<any[]>(initialJobs || []);
  const [rates, setRates] = useState<any[]>(initialRates || []);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [customMonto, setCustomMonto] = useState<Record<string, string>>({});
  const [saveDefault, setSaveDefault] = useState<Record<string, boolean>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, { monto: string; activo: boolean }>>({});

  async function refresh() {
    setBusy(true);
    const [jobsRes, ratesRes] = await Promise.all([getPendingRepairJobsAction(), getTechnicianRepairRatesAction()]);
    if (jobsRes.success) setJobs(jobsRes.data);
    if (ratesRes.success) setRates(ratesRes.data);
    setBusy(false);
  }

  async function handleApprove(job: any) {
    setLoadingId(job.id);
    setMessage("");
    const raw = customMonto[job.id];
    const parsed = raw !== undefined && raw !== "" ? Number(raw) : undefined;
    if (raw !== undefined && raw !== "" && (Number.isNaN(parsed) || (parsed ?? 0) < 0)) {
      setMessageTone("error");
      setMessage("Monto inválido. Déjalo vacío para usar la tarifa del técnico.");
      setLoadingId(null);
      return;
    }
    const res = await approveRepairJobAction({ jobId: job.id, customMonto: parsed, saveAsDefault: saveDefault[job.id] });
    setLoadingId(null);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return;
    }
    setMessageTone("ok");
    setMessage(`Trabajo ${res.data.jobCode} aprobado: RD$ ${res.data.montoTotal.toLocaleString("es-DO")} acreditados al wallet del técnico.`);
    await refresh();
  }

  async function handleSaveRate(technicianId: string) {
    const draft = rateDrafts[technicianId];
    if (!draft) return;
    const monto = Number(draft.monto);
    if (Number.isNaN(monto) || monto < 0) {
      setMessageTone("error");
      setMessage("Monto de tarifa inválido.");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await saveTechnicianRepairRateAction({ technicianId, montoPorReparacion: monto, activo: draft.activo });
    setBusy(false);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return;
    }
    setMessageTone("ok");
    setMessage("Tarifa guardada.");
    await refresh();
  }

  const formatDate = (value: string | Date) =>
    new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Trabajos por Aprobar y Pagar</h1>
          <p className="text-xs text-slate-500 mt-0.5">Reportes de reparaciones de técnicos pendientes de pago</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        </button>
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

      {jobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300" />
          <h3 className="text-sm font-bold text-slate-800">No hay trabajos pendientes</h3>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
             Cuando un técnico reporte resultados, aparecerán aquí para revisar qué equipos se pagan.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {jobs.map((job: any) => {
            const rate = job.technician?.repairRates?.[0];
            const balance = Number(job.technician?.wallet?.balance ?? 0);
            const defaultMonto = rate?.activo ? Number(rate.montoPorReparacion) : 50;
            const rawMonto = customMonto[job.id];
            const effectiveMonto = rawMonto !== undefined && rawMonto !== "" ? Number(rawMonto) : defaultMonto;
            const repairedCount = job.items.filter((item: any) => item.resultado !== "UNREPAIRED").length;
            const unrepairedCount = job.items.length - repairedCount;
            const total = repairedCount * (Number.isNaN(effectiveMonto) ? 0 : effectiveMonto);

            return (
              <div key={job.id} className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Package className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-800">{job.jobCode}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" /> {job.technician?.name || job.technician?.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-700">
                      PENDIENTE DE PAGO
                    </span>
                    <span className="text-slate-500">{formatDate(job.createdAt)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 p-5">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                         Equipos reportados ({job.items.length}) · {repairedCount} pagan · {unrepairedCount} no pagan
                      </div>
                      <div className="divide-y divide-slate-100">
                        {job.items.map((item: any) => (
                          <div key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
                            <span className="font-mono font-bold text-slate-800">{item.imei}</span>
                            <span className="text-slate-600">{item.modelo || item.marca || "—"}</span>
                            <span className="text-slate-500">{item.cliente}</span>
                             {item.warrantyCaseId && (
                              <span className="rounded-full bg-[#5750f1]/10 px-2 py-0.5 text-[10px] font-bold text-[#5750f1]">
                                GARANTÍA
                              </span>
                             )}
                             <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.resultado === "UNREPAIRED" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                               {item.resultado === "UNREPAIRED" ? "NO REPARADO · NO PAGA" : "REPARADO · PAGA"}
                             </span>
                            <span className="w-full text-slate-400 text-[11px] truncate" title={item.problema}>
                              {item.problema}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {job.observaciones && (
                      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500 italic">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" /> "{job.observaciones}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
                      <Wallet className="w-3.5 h-3.5" />
                      Balance del wallet del técnico:
                      <span className="font-bold text-emerald-600">RD$ {balance.toLocaleString("es-DO")}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 self-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tarifa por equipo</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">
                        RD$ {effectiveMonto.toLocaleString("es-DO")}
                      </p>
                      {rate?.activo ? (
                        <p className="text-[10px] text-slate-400">Tarifa configurada del técnico</p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Tarifa por defecto (RD$50)</p>
                      )}
                    </div>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Monto por equipo (opcional)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={customMonto[job.id] ?? ""}
                        onChange={(event) => setCustomMonto((prev) => ({ ...prev, [job.id]: event.target.value }))}
                        placeholder={`Usar ${defaultMonto}`}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(saveDefault[job.id])}
                        onChange={(event) => setSaveDefault((prev) => ({ ...prev, [job.id]: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 accent-[#5750f1]"
                      />
                      Guardar como tarifa del técnico
                    </label>
                    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Total a pagar</span>
                        <span className="font-black text-slate-800">
                          RD$ {total.toLocaleString("es-DO")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                         <span>{repairedCount} reparado(s) × RD$ {effectiveMonto.toLocaleString("es-DO")}</span>
                        <Coins className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApprove(job)}
                      disabled={loadingId === job.id}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loadingId === job.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {loadingId === job.id ? "Procesando..." : repairedCount > 0 ? "Aprobar y pagar reparados" : "Aprobar sin pago"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config de tarifas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5750f1]/10 text-[#5750f1]">
              <Coins className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Tarifas por técnico</h2>
              <p className="text-[11px] text-slate-500">RD$ por equipo reparado (por defecto: 50)</p>
            </div>
          </div>
        </div>

        {rates.length === 0 ? (
          <div className="p-10 text-center text-slate-500 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">Aún no hay tarifas configuradas. Usa el monto por defecto RD$50 o configura una por técnico.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Técnico</th>
                  <th className="px-5 py-3 w-48">Monto por equipo (RD$)</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rates.map((rate: any) => {
                  const draft = rateDrafts[rate.technicianId];
                  const montoValue = draft?.monto !== undefined ? draft.monto : String(Number(rate.montoPorReparacion));
                  const activoValue = draft?.activo !== undefined ? draft.activo : rate.activo;
                  return (
                    <tr key={rate.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {rate.technician?.name || rate.technician?.username}
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="number"
                          min={0}
                          value={montoValue}
                          onChange={(event) =>
                            setRateDrafts((prev) => ({ ...prev, [rate.technicianId]: { monto: event.target.value, activo: activoValue } }))
                          }
                          className="w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <label className="flex items-center gap-2 text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(activoValue)}
                            onChange={(event) =>
                              setRateDrafts((prev) => ({ ...prev, [rate.technicianId]: { monto: montoValue, activo: event.target.checked } }))
                            }
                            className="h-4 w-4 rounded border-slate-300 accent-[#5750f1]"
                          />
                          {activoValue ? "Activa" : "Inactiva"}
                        </label>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveRate(rate.technicianId)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#5750f1] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#463ec5] disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" /> Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
