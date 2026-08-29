"use client";

import { useMemo, useRef, useState } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Smartphone,
} from "lucide-react";
import { markDeviceFunctionalAction } from "../actions/revision-batch";

interface NoFuncionalDevice {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string;
  color: string | null;
  storageGb: number | null;
  status: string;
  result: string | null;
  grade: string | null;
  batteryHealth: number | null;
  functionalityNotes: string | null;
  reviewedAt: string | null;
}

interface NoFuncionalesModalProps {
  batchNumber: string;
  devices: NoFuncionalDevice[];
  onClose: () => void;
  onChanged: () => void;
}

export function NoFuncionalesModal({ batchNumber, devices, onClose, onChanged }: NoFuncionalesModalProps) {
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [automaticMode, setAutomaticMode] = useState(false);
  const automaticImeis = useRef(new Set<string>());

  const noFuncionales = useMemo(
    () => devices.filter((d) => d.result === "NON_FUNCTIONAL"),
    [devices]
  );

  const filtered = noFuncionales.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.imei ?? "").toLowerCase().includes(q) ||
      (d.serialNumber ?? "").toLowerCase().includes(q) ||
      (d.model ?? "").toLowerCase().includes(q) ||
      (d.brand ?? "").toLowerCase().includes(q)
    );
  });

  const deviceLabel = (d: NoFuncionalDevice) =>
    `${d.brand ?? ""} ${d.model}${d.storageGb ? ` ${d.storageGb}GB` : ""}`.trim() || "Sin modelo";

  const handleMarkFuncional = async (deviceId: string, automaticImei?: string) => {
    setLoadingId(deviceId);
    setError(null);
    setSuccess(null);
    const res = await markDeviceFunctionalAction({ deviceId });
    setLoadingId(null);
    if (res.success) {
      setSuccess(res.message ?? "Equipo marcado como funcional.");
      if (automaticImei) {
        setSearch("");
        automaticImeis.current.add(automaticImei);
      }
      onChanged();
    } else {
      if (automaticImei) automaticImeis.current.delete(automaticImei);
      setError(res.error ?? "Error al actualizar");
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setError(null);

    if (!automaticMode || !/^\d{15}$/.test(value) || automaticImeis.current.has(value)) return;

    const device = noFuncionales.find((candidate) => candidate.imei === value);
    if (!device) {
      setError("No encontré ese IMEI entre los no funcionales de este lote.");
      return;
    }

    automaticImeis.current.add(value);
    void handleMarkFuncional(device.id, value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white">
              <AlertTriangle className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">No Funcionales</h2>
              <p className="text-[11px] text-slate-500">
                Lote {batchNumber} · {noFuncionales.length} equipo{noFuncionales.length !== 1 ? "s" : ""} por recuperar — marcar funcional tras verificación física
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {error ? (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {success}
            </p>
          ) : null}

          {noFuncionales.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
              <h3 className="mt-3 text-lg font-black text-slate-800">¡Todo funcional!</h3>
              <p className="mt-1 text-xs text-slate-500">No hay equipos no funcionales en este lote.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar por IMEI, serie o modelo..."
                    inputMode="numeric"
                    autoFocus
                    disabled={loadingId !== null}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-700 focus:border-rose-300 focus:bg-white focus:outline-none disabled:cursor-wait disabled:opacity-60"
                  />
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={automaticMode}
                    onChange={(e) => {
                      setAutomaticMode(e.target.checked);
                      setError(null);
                    }}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Modo automático
                </label>
              </div>
              {automaticMode ? (
                <p className="-mt-2 mb-4 text-[11px] font-semibold text-emerald-700">
                  Escribe o escanea un IMEI de 15 dígitos: se marcará funcional y el campo se limpiará para el siguiente.
                </p>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {filtered.length === 0 ? (
                  <p className="p-10 text-center text-xs italic font-bold text-slate-400">No se encontraron equipos.</p>
                ) : (
                  <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                    {filtered.map((dev) => (
                      <div key={dev.id} className="flex items-center gap-3 px-4 py-3 hover:bg-rose-50/20">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                          <Smartphone className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{deviceLabel(dev)}</p>
                          <p className="font-mono text-[11px] font-bold text-rose-600">{dev.imei || dev.serialNumber}</p>
                          {dev.functionalityNotes ? (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">{dev.functionalityNotes}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Grado {dev.grade || "—"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkFuncional(dev.id)}
                          disabled={loadingId === dev.id}
                          className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {loadingId === dev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Marcar Funcional"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
