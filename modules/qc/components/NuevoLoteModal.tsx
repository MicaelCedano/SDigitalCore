"use client";

import { useRef, useState, useEffect } from "react";
import {
  createRevisionBatchAction,
  getRevisionBatchFormDataAction,
} from "../actions/revision-batch";
import { readPurchaseExcel } from "../lib/excel-parser";
import {
  X,
  Building2,
  Package,
  Layers,
  FileText,
  Scan,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";

interface NuevoLoteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function NuevoLoteModal({ onClose, onSuccess }: NuevoLoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Datos auxiliares
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [existingModels, setExistingModels] = useState<string[]>([]);
  const [loadingFormOptions, setLoadingFormOptions] = useState(true);

  // Formulario
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [customSupplier, setCustomSupplier] = useState("");
  const [branch, setBranch] = useState("Principal");
  const [defaultBrand, setDefaultBrand] = useState("Apple");
  const [defaultModel, setDefaultModel] = useState("iPhone 13 128GB");
  const [notes, setNotes] = useState("");
  const [devicesText, setDevicesText] = useState("");

  // Modo de ingreso: 'BULK' (pegar IMEIs) o 'TABLE' (línea por línea)
  const [entryMode, setEntryMode] = useState<"BULK" | "TABLE">("BULK");
  const [manualDevices, setManualDevices] = useState<
    { model: string; brand: string; imei: string; storageGb: string }[]
  >([
    { model: "iPhone 13 128GB", brand: "Apple", imei: "", storageGb: "128" },
  ]);

  useEffect(() => {
    async function loadFormData() {
      setLoadingFormOptions(true);
      const res = await getRevisionBatchFormDataAction();
      if (res.success && res.data) {
        setSuppliers(res.data.suppliers);
        setBranches(res.data.branches);
        setExistingModels(res.data.existingModels ?? []);
        if (res.data.branches.length > 0) {
          setBranch(res.data.branches[0].name);
        }
        if (res.data.suppliers.length > 0) {
          // Predeterminar el último proveedor usado en una compra (si sigue activo);
          // si no, el primero de la lista.
          const lastUsed = res.data.lastSupplierId
            ? res.data.suppliers.find((s) => s.id === res.data.lastSupplierId)
            : undefined;
          if (lastUsed) {
            setSupplierName(lastUsed.name);
            setSupplierId(lastUsed.id);
          } else {
            setSupplierName(res.data.suppliers[0].name);
            setSupplierId(res.data.suppliers[0].id);
          }
        }
      }
      setLoadingFormOptions(false);
    }
    loadFormData();
  }, []);

  const handleSupplierSelect = (val: string) => {
    if (val === "__NEW__") {
      setSupplierId("");
      setSupplierName("");
    } else {
      const found = suppliers.find((s) => s.id === val);
      if (found) {
        setSupplierId(found.id);
        setSupplierName(found.name);
      }
    }
  };

  const handleAddDeviceRow = () => {
    setManualDevices((prev) => [
      ...prev,
      { model: defaultModel || "iPhone 13 128GB", brand: defaultBrand || "Apple", imei: "", storageGb: "" },
    ]);
  };

  const handleRemoveDeviceRow = (index: number) => {
    setManualDevices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a seleccionar el mismo archivo
    if (!file) return;
    setImportingExcel(true);
    setError(null);
    setImportNotice(null);
    try {
      const { rows, errors } = await readPurchaseExcel(file);
      if (rows.length === 0 && errors.length === 0) {
        setError("No se encontraron datos en el Excel.");
        return;
      }
      if (rows.length > 0) {
        setManualDevices(
          rows.map((r) => ({
            model: r.modelName,
            brand: r.brand,
            imei: r.imei,
            storageGb: r.storageGb ? String(r.storageGb) : "",
          }))
        );
        setEntryMode("TABLE");
        setImportNotice(
          `${rows.length} equipo(s) importado(s) del Excel. Revisa la tabla antes de crear el lote.`
        );
      }
      if (errors.length > 0) {
        const sample = errors
          .slice(0, 5)
          .map((e) => `Fila ${e.row}: ${e.reason}`)
          .join(" · ");
        setError(
          `${errors.length} fila(s) omitida(s) del Excel: ${sample}${errors.length > 5 ? " ..." : ""}`
        );
      }
    } catch (err: any) {
      setError(err.message || "Error crítico al procesar el Excel.");
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalSupplierName = supplierId ? supplierName : customSupplier.trim();
    if (!finalSupplierName) {
      setError("Por favor seleccione o escriba el nombre del proveedor.");
      return;
    }

    if (!branch) {
      setError("Por favor seleccione una sucursal receptora.");
      return;
    }

    if (entryMode === "BULK" && !devicesText.trim()) {
      setError("Debe pegar al menos un IMEI o número de serie.");
      return;
    }

    if (entryMode === "TABLE" && manualDevices.every((d) => !d.imei && !d.model)) {
      setError("Debe completar al menos una línea con IMEI y modelo.");
      return;
    }

    setLoading(true);

    const payload = {
      supplierName: finalSupplierName,
      supplierId: supplierId || undefined,
      branch,
      defaultBrand,
      defaultModel,
      notes,
      devicesText: entryMode === "BULK" ? devicesText : undefined,
      devices:
        entryMode === "TABLE"
          ? manualDevices.map((d) => ({
              brand: d.brand || defaultBrand,
              model: d.model || defaultModel,
              imei: d.imei,
              storageGb: d.storageGb ? Number(d.storageGb) : undefined,
            }))
          : [],
    };

    const res = await createRevisionBatchAction(payload);
    setLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || "Ocurrió un error al registrar el Lote de Revisión.");
    }
  };

  const bulkCount = devicesText
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                Registrar Nuevo Lote de Revisión
              </h2>
              <p className="text-xs text-slate-500">
                Ingreso de mercancía de compra para auditoría y Control de Calidad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {importNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importNotice}</span>
            </div>
          )}

          {/* Sección 1: Datos del Proveedor y Sucursal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Proveedor de la Compra <span className="text-red-500">*</span>
              </label>
              {suppliers.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={supplierId || (customSupplier ? "__NEW__" : suppliers[0]?.id || "")}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5750f1]"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="__NEW__">+ Agregar otro proveedor...</option>
                  </select>

                  {(!supplierId || customSupplier) && (
                    <input
                      type="text"
                      placeholder="Escriba el nombre del nuevo proveedor"
                      value={customSupplier}
                      onChange={(e) => {
                        setCustomSupplier(e.target.value);
                        setSupplierId("");
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Ej: Suplidor Internacional / Apple Import"
                  value={customSupplier}
                  onChange={(e) => setCustomSupplier(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sucursal de Recepción <span className="text-red-500">*</span>
              </label>
              {branches.length > 0 ? (
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5750f1]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.code || "Sucursal"})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                />
              )}
            </div>
          </div>

          {/* Sección 2: Configuración por Defecto del Lote */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Marca Predeterminada
              </label>
              <input
                type="text"
                value={defaultBrand}
                onChange={(e) => setDefaultBrand(e.target.value)}
                placeholder="Apple"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Modelo Predeterminado (para carga masiva)
              </label>
              <input
                type="text"
                list="existing-models-list"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="Ej: iPhone 13 128GB"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
              <p className="mt-1 text-[10px] text-slate-400">Escribe o elige de los modelos ya registrados.</p>
            </div>
          </div>

          {/* Selector de Modo de Ingreso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-[#5750f1]" /> Equipos del Lote
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx"
                  ref={fileInputRef}
                  onChange={handleExcelUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importingExcel}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-[#5750f1]/30 bg-[#5750f1]/5 text-[#5750f1] hover:bg-[#5750f1]/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {importingExcel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  {importingExcel ? "Procesando..." : "Importar Excel"}
                </button>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEntryMode("BULK")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      entryMode === "BULK"
                        ? "bg-white text-[#5750f1] shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Pega Masiva (IMEIs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode("TABLE")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      entryMode === "TABLE"
                        ? "bg-white text-[#5750f1] shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Tabla Detallada
                  </button>
                </div>
              </div>
            </div>

            {entryMode === "BULK" ? (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={devicesText}
                  onChange={(e) => setDevicesText(e.target.value)}
                  placeholder="Pegue aquí los IMEIs o Números de Serie (uno por línea o separados por comas)...&#10;Ejemplo:&#10;358742091827364&#10;358742091827365&#10;358742091827366"
                  className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:bg-white transition-all"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    El sistema registrará cada IMEI individualmente como un equipo pendiente de revisión.
                  </span>
                  <span className="font-bold text-[#5750f1] bg-[#5750f1]/10 px-2.5 py-0.5 rounded-full">
                    {bulkCount} IMEI(s) detectados
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Modelo</th>
                        <th className="px-3 py-2">IMEI / Serie</th>
                        <th className="px-3 py-2 w-24">GB</th>
                        <th className="px-3 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manualDevices.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              list="existing-models-list"
                              value={row.model}
                              onChange={(e) => {
                                const next = [...manualDevices];
                                next[idx].model = e.target.value;
                                setManualDevices(next);
                              }}
                              placeholder="Ej: iPhone 13 128GB"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.imei}
                              onChange={(e) => {
                                const next = [...manualDevices];
                                next[idx].imei = e.target.value;
                                setManualDevices(next);
                              }}
                              placeholder="3587..."
                              className="w-full font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.storageGb}
                              onChange={(e) => {
                                const next = [...manualDevices];
                                next[idx].storageGb = e.target.value;
                                setManualDevices(next);
                              }}
                              placeholder="128"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {manualDevices.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDeviceRow(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleAddDeviceRow}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir Fila
                </button>
              </div>
            )}
          </div>

          {/* Notas Generales */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas u Observaciones Internas del Lote
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Lote #442 importado desde Miami, requiere prueba rápida de batería"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Registrando Lote...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Crear Lote de Revisión
                </>
              )}
            </button>
          </div>
        </form>

        {/* Datalist compartido: modelos ya registrados en el sistema */}
        {existingModels.length > 0 ? (
          <datalist id="existing-models-list">
            {existingModels.map((modelName) => (
              <option key={modelName} value={modelName} />
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  );
}
