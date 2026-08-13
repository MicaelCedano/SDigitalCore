"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCheck,
  CircleDollarSign,
  Hash,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserX,
  X,
} from "lucide-react";
import {
  getPenaltiesAction,
  getPenaltyDataByImeiAction,
  applyPenaltyByImeiAction,
  applyExternalPenaltyAction,
  revertPenaltyAction,
} from "../actions/penalties";

const DEFAULT_PENALTY_AMOUNT = 500; // RD$ (fórmula SDigitalSystem)

const money = (value: number) => `RD$ ${value.toLocaleString("es-DO")}`;

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

interface PenaltiesManagerProps {
  initialData: any;
}

type ConfirmTarget =
  | { kind: "apply"; device: any; reviewer: any; motivo: string; monto: number }
  | { kind: "external"; technician: any; imei: string; motivo: string; monto: number }
  | { kind: "revert"; penalty: any }
  | null;

export function PenaltiesManager({ initialData }: PenaltiesManagerProps) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Formulario por IMEI (penalidad interna)
  const [imeiSearch, setImeiSearch] = useState("");
  const [searchingImei, setSearchingImei] = useState(false);
  const [preview, setPreview] = useState<{ device: any; reviewer: any; lastReview: any } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [monto, setMonto] = useState(String(DEFAULT_PENALTY_AMOUNT));

  // Formulario externo
  const [extTecnicoId, setExtTecnicoId] = useState("");
  const [extImei, setExtImei] = useState("");
  const [extModelo, setExtModelo] = useState("");
  const [extMonto, setExtMonto] = useState(String(DEFAULT_PENALTY_AMOUNT));
  const [extMotivo, setExtMotivo] = useState("");

  const [processing, setProcessing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    setRefreshing(true);
    const res = await getPenaltiesAction();
    if (res.success && res.data) setData(res.data);
    setRefreshing(false);
  };

  const handleSearchImei = async () => {
    const imei = imeiSearch.trim();
    if (!imei) return showToast("error", "Escribe un IMEI para buscar.");
    setSearchingImei(true);
    setPreview(null);
    try {
      const res = await getPenaltyDataByImeiAction({ imei });
      if (res.success) {
        setPreview(res.data);
      } else {
        showToast("error", res.error);
      }
    } catch {
      showToast("error", "No se pudo conectar con el servidor.");
    } finally {
      setSearchingImei(false);
    }
  };

  const openApplyConfirm = () => {
    if (!preview?.reviewer) return showToast("error", "Primero busca el IMEI y confirma el revisor.");
    if (motivo.trim().length < 3) return showToast("error", "Escribe un motivo (mínimo 3 caracteres).");
    const amount = Number(monto);
    if (!amount || amount <= 0) return showToast("error", "Monto inválido.");
    setConfirmTarget({ kind: "apply", device: preview.device, reviewer: preview.reviewer, motivo: motivo.trim(), monto: amount });
  };

  const openExternalConfirm = () => {
    if (!extTecnicoId) return showToast("error", "Elige al técnico culpable.");
    if (!extImei.trim()) return showToast("error", "Escribe el IMEI.");
    if (extMotivo.trim().length < 3) return showToast("error", "Escribe un motivo (mínimo 3 caracteres).");
    const amount = Number(extMonto);
    if (!amount || amount <= 0) return showToast("error", "Monto inválido.");
    const technician = (data?.techOptions || []).find((t: any) => t.id === extTecnicoId);
    if (!technician) return showToast("error", "Técnico no encontrado.");
    setConfirmTarget({ kind: "external", technician, imei: extImei.trim(), motivo: extMotivo.trim(), monto: amount });
  };

  const openRevertConfirm = (penalty: any) => {
    setConfirmTarget({ kind: "revert", penalty });
  };

  const confirmAction = async () => {
    if (!confirmTarget) return;
    setProcessing(true);
    let res: any = null;

    if (confirmTarget.kind === "apply") {
      res = await applyPenaltyByImeiAction({
        imei: confirmTarget.device.imei,
        motivo: confirmTarget.motivo,
        monto: confirmTarget.monto,
      });
      if (res.success) {
        setImeiSearch("");
        setPreview(null);
        setMotivo("");
        setMonto(String(DEFAULT_PENALTY_AMOUNT));
      }
    } else if (confirmTarget.kind === "external") {
      res = await applyExternalPenaltyAction({
        technicianId: confirmTarget.technician.id,
        imei: confirmTarget.imei,
        modelo: extModelo.trim() || undefined,
        monto: confirmTarget.monto,
        motivo: confirmTarget.motivo,
      });
      if (res.success) {
        setExtTecnicoId("");
        setExtImei("");
        setExtModelo("");
        setExtMonto(String(DEFAULT_PENALTY_AMOUNT));
        setExtMotivo("");
      }
    } else if (confirmTarget.kind === "revert") {
      res = await revertPenaltyAction({ id: confirmTarget.penalty.id });
    }

    setProcessing(false);
    const target = confirmTarget;
    setConfirmTarget(null);
    if (res?.success) {
      showToast("success", res.message ?? "Operación completada.");
      refresh();
    } else {
      showToast("error", res?.error || "No se pudo completar la operación.");
    }
  };

  const penalties = (data?.penalties || []).filter((p: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const technician = p.technician?.name || p.technician?.username || "";
    return [technician, p.deviceImei, p.motivo].filter(Boolean).map((v) => String(v).toLowerCase()).join(" ").includes(term);
  });

  const summary = data?.summary || { total: 0, active: 0, internalCount: 0, externalCount: 0, activeTotal: 0 };
  const technicians = data?.technicians || [];
  const techOptions = data?.techOptions || [];

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10";
  const labelClass = "text-[11px] font-bold text-slate-500 uppercase tracking-wider";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Penalidades</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sanciones al wallet de control de calidad y técnicos por equipos dañados o fallas en la revisión.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar técnico, IMEI o motivo..."
              className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Registradas", value: String(summary.total), icon: ShieldAlert, tone: "bg-[#5750f1]/10 text-[#5750f1] border-[#5750f1]/20" },
          { label: "Activas", value: String(summary.active), icon: AlertTriangle, tone: "bg-rose-50 text-rose-600 border-rose-200" },
          { label: "Internas (por IMEI)", value: String(summary.internalCount), icon: Hash, tone: "bg-indigo-50 text-indigo-600 border-indigo-200" },
          { label: "Externas", value: String(summary.externalCount), icon: UserX, tone: "bg-amber-50 text-amber-600 border-amber-200" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className={`inline-flex p-2.5 rounded-xl border ${card.tone}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-slate-800">{card.value}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Aplicar penalidades */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Por IMEI */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-200">
              <Hash className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Penalidad por IMEI</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Busca el equipo y se penalizará al último QC que lo revisó.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={imeiSearch}
              onChange={(e) => setImeiSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchImei()}
              placeholder="IMEI del equipo..."
              className={inputClass}
            />
            <button
              onClick={handleSearchImei}
              disabled={searchingImei}
              className="px-4 py-2.5 rounded-xl bg-[#5750f1] hover:bg-[#463ec5] text-white text-sm font-bold shadow-md shadow-[#5750f1]/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {searchingImei ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>

          {preview && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Equipo</span>
                <span className="text-xs font-bold text-slate-800">
                  {preview.device.brand ? `${preview.device.brand} ` : ""}{preview.device.model}
                </span>
              </div>
              {preview.reviewer ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Último revisor</span>
                    <span className="text-xs font-bold text-slate-800">
                      {preview.reviewer.name || preview.reviewer.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resultado</span>
                    <span
                      className={`text-xs font-black ${
                        preview.lastReview?.result === "FUNCTIONAL" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {preview.lastReview?.result === "FUNCTIONAL" ? "FUNCIONAL" : "NO FUNCIONAL"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revisado</span>
                    <span className="text-xs font-bold text-slate-700">{formatDate(preview.lastReview?.reviewedAt)}</span>
                  </div>
                  {preview.lastReview?.functionalityNotes && (
                    <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                      {preview.lastReview.functionalityNotes}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-rose-600 font-bold">
                  Sin revisor registrado (equipo legacy). Usa una penalidad externa eligiendo al culpable.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className={labelClass}>Motivo</label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: marcó funcional un equipo dañado"
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <div>
              <label className={labelClass}>Monto (RD$)</label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                min={1}
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <button
              onClick={openApplyConfirm}
              disabled={!preview?.reviewer || processing}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Aplicar penalidad
            </button>
          </div>
        </div>

        {/* Externa */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
              <UserX className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Penalidad externa</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Elige al culpable directamente (equipos devueltos por clientes, legacy, etc.).
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className={labelClass}>Culpable</label>
              <select
                value={extTecnicoId}
                onChange={(e) => setExtTecnicoId(e.target.value)}
                className={`${inputClass} mt-1.5`}
              >
                <option value="">Selecciona un técnico...</option>
                {techOptions.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.username ? `(@${t.username})` : ""} — {t.roleCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>IMEI</label>
                <input
                  type="text"
                  value={extImei}
                  onChange={(e) => setExtImei(e.target.value)}
                  placeholder="IMEI del equipo"
                  className={`${inputClass} mt-1.5`}
                />
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <input
                  type="text"
                  value={extModelo}
                  onChange={(e) => setExtModelo(e.target.value)}
                  placeholder="Ej: iPhone 13"
                  className={`${inputClass} mt-1.5`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Motivo</label>
              <input
                type="text"
                value={extMotivo}
                onChange={(e) => setExtMotivo(e.target.value)}
                placeholder="Ej: equipo devuelto por cliente dañado"
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <div>
              <label className={labelClass}>Monto (RD$)</label>
              <input
                type="number"
                value={extMonto}
                onChange={(e) => setExtMonto(e.target.value)}
                min={1}
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <button
              onClick={openExternalConfirm}
              disabled={processing}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <UserX className="w-4 h-4" />
              Aplicar penalidad externa
            </button>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg border border-[#5750f1]/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Historial de penalidades</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {penalties.length} registros
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-4">Fecha</th>
                <th className="pb-3 pr-4">Tipo</th>
                <th className="pb-3 pr-4">Técnico</th>
                <th className="pb-3 pr-4">IMEI / Modelo</th>
                <th className="pb-3 pr-4">Motivo</th>
                <th className="pb-3 pr-4 text-right">Monto</th>
                <th className="pb-3 pr-4">Estado</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {penalties.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    Sin penalidades registradas.
                  </td>
                </tr>
              )}
              {penalties.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 pr-4 text-xs font-semibold text-slate-600 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        p.type === "INTERNAL"
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {p.type === "INTERNAL" ? <Hash className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {p.type === "INTERNAL" ? "Interna" : "Externa"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs font-bold text-slate-800">
                    {p.technician?.name || p.technician?.username || "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs font-mono text-slate-600">
                    {p.deviceImei || "—"}
                    {p.deviceModel ? <span className="text-slate-400"> · {p.deviceModel}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600 max-w-[220px] truncate" title={p.motivo}>
                    {p.motivo}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs font-black text-rose-600 whitespace-nowrap">{money(Number(p.monto))}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        p.status === "ACTIVE"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {p.status === "ACTIVE" ? <AlertTriangle className="w-3 h-3" /> : <BadgeCheck className="w-3 h-3" />}
                      {p.status === "ACTIVE" ? "Activa" : "Revertida"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {p.status === "ACTIVE" && (
                      <button
                        onClick={() => openRevertConfirm(p)}
                        disabled={processing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revertir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* % por técnico */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
            <CircleDollarSign className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Desempeño por técnico</h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-4">Técnico</th>
                <th className="pb-3 pr-4">Rol</th>
                <th className="pb-3 pr-4 text-right">Revisados</th>
                <th className="pb-3 pr-4 text-right">Penalidades</th>
                <th className="pb-3 text-right">% Penalizado</th>
              </tr>
            </thead>
            <tbody>
              {technicians.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    Sin datos de desempeño todavía.
                  </td>
                </tr>
              )}
              {technicians.map((t: any) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 pr-4 text-xs font-bold text-slate-800">{t.name}</td>
                  <td className="py-3 pr-4 text-xs font-semibold text-slate-500">{t.roleCode}</td>
                  <td className="py-3 pr-4 text-right text-xs font-semibold text-slate-600">{t.totalReviewed}</td>
                  <td className="py-3 pr-4 text-right text-xs font-black text-rose-600">{t.totalPenalties}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        t.percentage === 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : t.percentage <= 5
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {t.percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación custom */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 pt-6 pb-2 flex items-start justify-between">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  confirmTarget.kind === "revert"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-rose-50 text-rose-600 border-rose-200"
                }`}
              >
                {confirmTarget.kind === "revert" ? (
                  <RotateCcw className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <button
                onClick={() => !processing && setConfirmTarget(null)}
                disabled={processing}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                {confirmTarget.kind === "revert" ? "Revertir penalidad" : "Aplicar penalidad"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {confirmTarget.kind === "revert"
                  ? "El saldo será devuelto al técnico y la penalidad quedará como revertida (no se borra: auditoría)."
                  : "El monto se descontará del wallet del técnico y quedará registrado el asiento de la sanción."}
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                {confirmTarget.kind === "apply" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Técnico</span>
                      <span className="text-xs font-bold text-slate-800">
                        {confirmTarget.reviewer.name || confirmTarget.reviewer.username}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">IMEI</span>
                      <span className="font-mono font-black text-slate-800 text-xs">{confirmTarget.device.imei}</span>
                    </div>
                  </>
                )}
                {confirmTarget.kind === "external" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Culpable</span>
                      <span className="text-xs font-bold text-slate-800">{confirmTarget.technician.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">IMEI</span>
                      <span className="font-mono font-black text-slate-800 text-xs">{confirmTarget.imei}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Motivo</span>
                  <span className="text-xs font-bold text-slate-700 text-right max-w-[60%]">
                    {confirmTarget.kind === "revert" ? confirmTarget.penalty.motivo : confirmTarget.motivo}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monto</span>
                  <span
                    className={`text-base font-black ${
                      confirmTarget.kind === "revert" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {money(confirmTarget.kind === "revert" ? Number(confirmTarget.penalty.monto) : confirmTarget.monto)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAction}
                disabled={processing}
                className={`px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-md transition-colors disabled:opacity-40 flex items-center gap-2 ${
                  confirmTarget.kind === "revert"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                }`}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                {confirmTarget.kind === "revert" ? "Sí, devolver saldo" : "Aplicar y descontar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-bold text-white animate-in slide-in-from-bottom-4 duration-300 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
