"use client";

import { useMemo, useRef, useState } from "react";
import { X, Plus, Loader2, AlertTriangle, CheckCircle2, Smartphone, FileSpreadsheet } from "lucide-react";
import { addDevicesToBatchAction } from "../actions/revision-batch";

type DeviceRow = { model: string; brand: string; imei: string; storageGb: string };

const EMPTY_DEVICE_ROW: DeviceRow = { model: "", brand: "", imei: "", storageGb: "" };

interface AddDevicesModalProps {
  batchId: string;
  batchNumber: string;
  existingModels: string[];
  onClose: () => void;
  onChanged: () => void;
}

export function AddDevicesModal({ batchId, batchNumber, existingModels, onClose, onChanged }: AddDevicesModalProps) {
  const [entryMode, setEntryMode] = useState<"BULK" | "MANUAL">("BULK");
  const [devicesText, setDevicesText] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [defaultBrand, setDefaultBrand] = useState("");
  const [rows, setRows] = useState<DeviceRow[]>([{ ...EMPTY_DEVICE_ROW }]);
  const [loading, setLoading] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCount = useMemo(() => {
    return devicesText
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean).length;
  }, [devicesText]);

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportingExcel(true);
    setError(null);
    setSuccess(null);
    setImportNotice(null);

    try {
      const { readPurchaseExcel } = await import("../lib/excel-parser");
      const result = await readPurchaseExcel(file);

      if (result.rows.length === 0 && result.errors.length === 0) {
        setError("No se encontraron datos en el Excel.");
        return;
      }

      if (result.rows.length > 0) {
        setRows(
          result.rows.map((row) => ({
            model: row.modelName,
            brand: row.brand,
            imei: row.imei,
            storageGb: row.storageGb ? String(row.storageGb) : "",
          })),
        );
        setEntryMode("MANUAL");
        setImportNotice(
          `${result.rows.length} equipo(s) importado(s) del Excel. Revisa la tabla antes de agregarlos a la compra.`,
        );
      }

      if (result.errors.length > 0) {
        const sample = result.errors
          .slice(0, 5)
          .map((item) => `Fila ${item.row}: ${item.reason}`)
          .join(" · ");
        setError(
          `${result.errors.length} fila(s) omitida(s) del Excel: ${sample}${result.errors.length > 5 ? " ..." : ""}`,
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar el Excel.");
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (entryMode === "BULK" && !devicesText.trim()) {
      setError("Pega al menos un IMEI o número de serie.");
      return;
    }
    if (entryMode === "MANUAL" && rows.every((r) => !r.imei && !r.model)) {
      setError("Completa al menos una fila con IMEI y modelo.");
      return;
    }

    setLoading(true);
    const res = await addDevicesToBatchAction({
      batchId,
      devicesText: entryMode === "BULK" ? devicesText : undefined,
      defaultModel: defaultModel || undefined,
      defaultBrand: defaultBrand || undefined,
      devices:
        entryMode === "MANUAL"
          ? rows
              .filter((r) => r.imei || r.model)
              .map((r) => ({
                model: r.model,
                brand: r.brand,
                imei: r.imei || null,
                storageGb: r.storageGb ? Number(r.storageGb) : undefined,
              }))
          : [],
    });
    setLoading(false);

    if (res.success) {
      setSuccess(res.message ?? "Equipos agregados.");
      setDevicesText("");
      setRows([{ ...EMPTY_DEVICE_ROW }]);
      setImportNotice(null);
      onChanged();
    } else {
      setError(res.error ?? "Error al agregar equipos.");
    }
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
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5750f1] text-white">
              <Plus className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">Agregar Equipos</h2>
              <p className="text-[11px] text-slate-500">
                Compra {batchNumber} · se agregan al lote para revisión QC
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
          {importNotice ? (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {importNotice}
            </p>
          ) : null}

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importingExcel || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5750f1]/30 bg-[#5750f1]/5 px-3 py-2 text-xs font-bold text-[#5750f1] transition hover:bg-[#5750f1]/10 disabled:opacity-50 sm:w-auto"
            >
              {importingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {importingExcel ? "Procesando Excel..." : "Importar Excel"}
            </button>
            <p className="mt-1.5 text-[11px] text-slate-500">
              El archivo .xlsx debe incluir las columnas IMEI y Modelo. La columna Marca es opcional.
            </p>
          </div>

          {/* Modo de ingreso */}
          <div className="mb-4 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setEntryMode("BULK")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${entryMode === "BULK" ? "bg-white text-[#5750f1] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Pega Masiva (IMEIs)
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("MANUAL")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${entryMode === "MANUAL" ? "bg-white text-[#5750f1] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Fila Manual
            </button>
          </div>

          {entryMode === "BULK" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Modelo (para los IMEIs pegados)</label>
                  <input
                    type="text"
                    list="add-models-list"
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    placeholder="Ej: iPhone 13 128GB"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#5750f1] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Marca</label>
                  <input
                    type="text"
                    value={defaultBrand}
                    onChange={(e) => setDefaultBrand(e.target.value)}
                    placeholder="Ej. Samsung"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#5750f1] focus:outline-none"
                  />
                </div>
              </div>
              <textarea
                rows={6}
                value={devicesText}
                onChange={(e) => setDevicesText(e.target.value)}
                placeholder="Pegue aquí los IMEIs o Números de Serie (uno por línea o separados por comas)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-800 placeholder-slate-400 focus:border-[#5750f1] focus:bg-white focus:outline-none"
              />
              <p className="text-xs text-slate-500">
                <span className="font-bold text-[#5750f1]">{bulkCount}</span> IMEI(s) detectados · Los IMEIs ya existentes fuera de cola de revisión se reingresan con su historial.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[620px] w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Marca</th>
                      <th className="px-3 py-2">Modelo</th>
                      <th className="px-3 py-2">IMEI / Serie</th>
                      <th className="w-20 px-3 py-2">GB</th>
                      <th className="px-3 py-2 w-20 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.brand}
                            onChange={(e) => {
                              const next = [...rows];
                              next[idx].brand = e.target.value;
                              setRows(next);
                            }}
                            placeholder="Ej. Samsung"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-[#5750f1] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            list="add-models-list"
                            value={row.model}
                            onChange={(e) => {
                              const next = [...rows];
                              next[idx].model = e.target.value;
                              setRows(next);
                            }}
                            placeholder="iPhone 13 128GB"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-[#5750f1] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.imei}
                            onChange={(e) => {
                              const next = [...rows];
                              next[idx].imei = e.target.value;
                              setRows(next);
                            }}
                            placeholder="3587..."
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs focus:border-[#5750f1] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={row.storageGb}
                            onChange={(e) => {
                              const next = [...rows];
                              next[idx].storageGb = e.target.value;
                              setRows(next);
                            }}
                            placeholder="128"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-[#5750f1] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {rows.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, { ...EMPTY_DEVICE_ROW }])}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir Fila
              </button>
            </div>
          )}

          {existingModels.length > 0 ? (
            <datalist id="add-models-list">
              {existingModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || importingExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Agregar a la Compra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
