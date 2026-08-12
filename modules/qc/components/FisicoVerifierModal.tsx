"use client";

import { useMemo, useState } from "react";
import {
  X,
  Fingerprint,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Layers,
  Smartphone,
  Loader2,
} from "lucide-react";

interface VerifierDevice {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string;
  color: string | null;
  storageGb: number | null;
  status: string;
  result: string | null;
}

interface FisicoVerifierModalProps {
  batchNumber: string;
  devices: VerifierDevice[];
  onClose: () => void;
}

export function FisicoVerifierModal({ batchNumber, devices, onClose }: FisicoVerifierModalProps) {
  const [imeisInput, setImeisInput] = useState("");
  const [results, setResults] = useState<null | {
    matches: VerifierDevice[];
    extraFisicos: { imei: string; motivo: string }[];
    missingFisicos: VerifierDevice[];
    totalFisicos: number;
    totalDb: number;
  }>(null);

  const funcionales = useMemo(
    () => devices.filter((d) => d.result === "FUNCTIONAL"),
    [devices]
  );

  const handleMatch = () => {
    const rawImeis = imeisInput
      .split(/[\s,]+/)
      .map((i) => i.trim())
      .filter(Boolean)
      .filter((i: string) => i.toLowerCase() !== "imei");
    const imeisFisicos = Array.from(new Set(rawImeis));

    if (imeisFisicos.length === 0) {
      setResults(null);
      return;
    }

    const todosMap = new Map<string, VerifierDevice>();
    for (const d of devices) {
      if (d.imei) todosMap.set(d.imei, d);
      if (d.serialNumber) todosMap.set(d.serialNumber, d);
    }
    const funcionalesMap = new Map<string, VerifierDevice>();
    for (const d of funcionales) {
      if (d.imei) funcionalesMap.set(d.imei, d);
      if (d.serialNumber) funcionalesMap.set(d.serialNumber, d);
    }

    const matches: VerifierDevice[] = [];
    const extraFisicos: { imei: string; motivo: string }[] = [];

    imeisFisicos.forEach((imei) => {
      const enFuncionales = funcionalesMap.get(imei);
      if (enFuncionales) {
        matches.push(enFuncionales);
      } else {
        const enBd = todosMap.get(imei);
        extraFisicos.push({
          imei,
          motivo: enBd
            ? `Registrado como ${enBd.result === "NON_FUNCTIONAL" ? "No funcional" : enBd.result === "FUNCTIONAL" ? "Funcional (duplicado)" : "Sin revisar"}`
            : "No pertenece a este lote",
        });
      }
    });

    // Faltan en físico (solo de la lista funcional, como System)
    const funcionalesImeis = new Set<string>();
    for (const eq of funcionales) {
      if (eq.imei) funcionalesImeis.add(eq.imei);
      if (eq.serialNumber) funcionalesImeis.add(eq.serialNumber);
    }
    const missingFisicos = funcionales.filter(
      (eq) => !imeisFisicos.includes(eq.imei ?? "") && !imeisFisicos.includes(eq.serialNumber ?? "")
    );

    setResults({
      matches,
      extraFisicos,
      missingFisicos,
      totalFisicos: imeisFisicos.length,
      totalDb: funcionales.length,
    });
  };

  const deviceLabel = (d: VerifierDevice) =>
    `${d.brand ?? ""} ${d.model}${d.storageGb ? ` ${d.storageGb}GB` : ""}`.trim() || "Sin modelo";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5750f1] text-white">
              <Fingerprint className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">Verificador Físico</h2>
              <p className="text-[11px] text-slate-500">
                Lote {batchNumber} · Pega los IMEIs físicos para compararlos con los funcionales del sistema
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {!results ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                <Smartphone className="h-4 w-4 text-[#5750f1]" /> Lista de IMEIs Físicos (Pistola/Escáner)
              </h3>
              <textarea
                rows={8}
                value={imeisInput}
                onChange={(e) => setImeisInput(e.target.value)}
                placeholder={"Pega los IMEIs aquí. Puedes separarlos por espacios, comas o saltos de línea...\nEjemplo:\n358742091827364\n358742091827365"}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800 placeholder-slate-400 focus:border-[#5750f1] focus:bg-white focus:outline-none"
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Funcionales en este lote: <span className="font-black text-emerald-600">{funcionales.length}</span> · No funcionales:{" "}
                  <span className="font-black text-red-500">{devices.length - funcionales.length}</span>
                </p>
                <button
                  type="button"
                  onClick={handleMatch}
                  disabled={!imeisInput.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:opacity-40"
                >
                  <ClipboardCheck className="h-4 w-4" /> Verificar Coincidencias
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                  <p className="text-[9px] font-black tracking-widest text-emerald-600 uppercase">Coincidencias (OK)</p>
                  <p className="mt-0.5 text-2xl font-black text-emerald-600">{results.matches.length}</p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-center">
                  <p className="text-[9px] font-black tracking-widest text-indigo-600 uppercase">Total Ingresados</p>
                  <p className="mt-0.5 text-2xl font-black text-indigo-600">{results.totalFisicos}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                  <p className="text-[9px] font-black tracking-widest text-amber-600 uppercase">Faltan en físico</p>
                  <p className="mt-0.5 text-2xl font-black text-amber-600">{results.missingFisicos.length}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-center">
                  <p className="text-[9px] font-black tracking-widest text-rose-600 uppercase">Erróneos / Extras</p>
                  <p className="mt-0.5 text-2xl font-black text-rose-600">{results.extraFisicos.length}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-bold text-slate-600">
                  Total de equipos funcionales en este lote: <span className="text-[#5750f1]">{results.totalDb}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setResults(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hacer otra verificación
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Columna izquierda: extras y faltantes */}
                <div className="space-y-5 lg:col-span-1">
                  <div className="rounded-2xl border border-rose-100 p-4">
                    <h3 className="mb-3 flex items-center gap-2 border-b border-slate-50 pb-2 text-sm font-black text-slate-800">
                      <AlertCircle className="h-4 w-4 text-rose-500" /> No funcionales o externos
                      <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">{results.extraFisicos.length}</span>
                    </h3>
                    {results.extraFisicos.length > 0 ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {results.extraFisicos.map((e, i) => (
                          <div key={i} className="rounded-xl border border-rose-100/60 bg-rose-50/50 p-2.5">
                            <p className="font-mono text-xs font-bold text-slate-800">{e.imei}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-rose-600">{e.motivo}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-3 text-center text-xs italic text-slate-400">Sin equipos sobrantes o no funcionales.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-100 p-4">
                    <h3 className="mb-3 flex items-center gap-2 border-b border-slate-50 pb-2 text-sm font-black text-slate-800">
                      <Layers className="h-4 w-4 text-amber-500" /> Pendientes de escaneo físico
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">{results.missingFisicos.length}</span>
                    </h3>
                    {results.missingFisicos.length > 0 ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {results.missingFisicos.map((eq, i) => (
                          <div key={i} className="rounded-xl border border-amber-50 bg-amber-50/30 p-2.5">
                            <p className="font-mono text-xs font-bold text-slate-800">{eq.imei || eq.serialNumber}</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600">{deviceLabel(eq)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-3 text-center text-xs italic text-slate-400">Escaneaste todos los disponibles en sistema.</p>
                    )}
                  </div>
                </div>

                {/* Columna derecha: coincidencias */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-emerald-100 p-4">
                    <h3 className="mb-3 flex items-center gap-2 border-b border-slate-50 pb-2 text-sm font-black text-slate-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Coincidencias de este lote
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">{results.matches.length}</span>
                    </h3>
                    {results.matches.length > 0 ? (
                      <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                        {results.matches.map((eq, i) => (
                          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-xs font-bold text-slate-800">{deviceLabel(eq)}</p>
                            <p className="mt-1 font-mono text-[11px] font-bold text-slate-600">{eq.imei || eq.serialNumber}</p>
                            <p className="mt-1.5 text-[9px] font-bold text-slate-500 uppercase">
                              {eq.color || "N/A"} · {eq.storageGb || "?"}GB
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm italic font-bold text-slate-400">Ningún IMEI escaneado coincidió con un equipo en el sistema.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
