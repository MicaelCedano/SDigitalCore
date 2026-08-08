"use client";

import { useState, useEffect, useRef } from "react";
import { saveStockCountAction } from "../actions/stock-count";
import { getCatalogModelsAction } from "../actions/goods-receipt";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { StockCountInput } from "@/lib/validation/stock-count";
import { useStockCountDraft } from "../hooks/useStockCountDraft";
import { exportStockCountToExcel } from "@/lib/utils/excel-export-stock-count";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  X,
  RefreshCw,
  Barcode,
  Layers,
  Sparkles,
  Zap,
  ClipboardList,
  ScanLine,
} from "lucide-react";

interface StockCountFormProps {
  initialData?: StockCountInput | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyItem = {
  code: "",
  description: "",
  expectedQty: 0,
  countedQty: 0,
  difference: 0,
  scannedImeis: "",
  notes: "",
};

export function StockCountForm({
  initialData,
  onSuccess,
  onCancel,
}: StockCountFormProps) {
  const { savedDraftData, hasSavedDraft, lastSavedAt, saveDraft, clearDraft } =
    useStockCountDraft();

  const [title, setTitle] = useState(
    initialData?.title || "Conteo Físico de Celulares & Equipos"
  );
  const [branch, setBranch] = useState(initialData?.branch || "");
  const [performedBy, setPerformedBy] = useState(initialData?.performedBy || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [items, setItems] = useState<any[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [{ ...emptyItem }]
  );

  const [scanInput, setScanInput] = useState("");
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(
    !initialData && hasSavedDraft
  );

  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Cargar sucursales activas
  useEffect(() => {
    async function loadBranches() {
      const res = await getBranchesAction(true);
      if (res.success && res.data && res.data.length > 0) {
        setBranchesList(res.data);
        setBranch((current) => current || res.data[0].name);
      }
    }
    loadBranches();
  }, []);

  // Auto-enfoque en el lector de escaneo
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, []);

  // Autocompletado de modelos
  const handleDescriptionChange = async (index: number, val: string) => {
    handleItemChange(index, "description", val);
    setActiveSuggestionIndex(index);

    if (val.trim().length >= 1) {
      const res = await getCatalogModelsAction(val);
      if (res.success && res.data) {
        setCatalogSuggestions(res.data);
      }
    } else {
      setCatalogSuggestions([]);
    }
  };

  const handleSelectSuggestion = (index: number, modelName: string) => {
    handleItemChange(index, "description", modelName);
    setCatalogSuggestions([]);
    setActiveSuggestionIndex(null);
  };

  // Auto-guardado local debounced
  useEffect(() => {
    if (initialData) return;

    const timer = setTimeout(() => {
      saveDraft({
        title,
        branch,
        performedBy,
        notes,
        status: "IN_PROGRESS",
        items: items.map((i) => {
          const exp = Number(i.expectedQty) || 0;
          const cnt = Number(i.countedQty) || 0;
          return {
            ...i,
            expectedQty: exp,
            countedQty: cnt,
            difference: cnt - exp,
          };
        }),
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, branch, performedBy, notes, items, saveDraft, initialData]);

  // Escaneo Rápido de IMEI o Código de barras (Teclado / Lector Laser)
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scannedCode = scanInput.trim();
    if (!scannedCode) return;

    setScanSuccessMsg(null);

    // Buscar si el IMEI o código ya pertenece a algún ítem en la lista
    let found = false;
    setItems((prev) => {
      return prev.map((item) => {
        const existingImeis = item.scannedImeis
          ? item.scannedImeis.split("\n").map((s: string) => s.trim())
          : [];

        if (
          (item.code && item.code.trim().toLowerCase() === scannedCode.toLowerCase()) ||
          (item.description && item.description.trim().toLowerCase().includes(scannedCode.toLowerCase()))
        ) {
          found = true;
          const updatedCount = Number(item.countedQty) + 1;
          const updatedImeis = item.scannedImeis ? `${item.scannedImeis}\n${scannedCode}` : scannedCode;
          setScanSuccessMsg(`+1 en "${item.description}" (IMEI / Código registrado)`);
          return {
            ...item,
            countedQty: updatedCount,
            difference: updatedCount - Number(item.expectedQty),
            scannedImeis: updatedImeis,
          };
        }
        return item;
      });
    });

    // Si no coincidió con ningún modelo existente, agregamos uno nuevo escaneado
    if (!found) {
      const newCountedQty = 1;
      setItems((prev) => [
        ...prev,
        {
          code: scannedCode.length < 10 ? scannedCode : "",
          description: "",
          expectedQty: 0,
          countedQty: newCountedQty,
          difference: newCountedQty,
          scannedImeis: scannedCode,
          notes: "",
        },
      ]);
      setScanSuccessMsg(`Código ${scannedCode} agregado. Completa la descripción real del producto.`);
    }

    setScanInput("");
    if (scanInputRef.current) scanInputRef.current.focus();
  };

  const handleRestoreDraft = () => {
    if (savedDraftData) {
      setTitle(savedDraftData.title || "Conteo Físico de Celulares & Equipos");
      setBranch(savedDraftData.branch || "");
      setPerformedBy(savedDraftData.performedBy || "");
      setNotes(savedDraftData.notes || "");
      if (savedDraftData.items && savedDraftData.items.length > 0) {
        setItems(savedDraftData.items);
      }
      setShowDraftBanner(false);
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === "expectedQty" || field === "countedQty" || field === "scannedImeis") {
        const exp = Number(current.expectedQty) || 0;
        let cnt = Number(current.countedQty) || 0;

        // Si se pegan IMEIs en bloque en el textarea, ajustar countedQty si es mayor
        if (field === "scannedImeis" && value) {
          const imeiLines = value.split("\n").filter((s: string) => s.trim() !== "").length;
          if (imeiLines > cnt) cnt = imeiLines;
        }

        current.expectedQty = exp;
        current.countedQty = cnt;
        current.difference = cnt - exp;
      }

      updated[index] = current;
      return updated;
    });
  };

  const handleSubmit = async (status: "IN_PROGRESS" | "COMPLETED") => {
    setErrorMessage(null);

    const invalidItem = items.find((i) => !i.description || !i.description.trim());
    if (invalidItem) {
      setErrorMessage("Todos los modelos contados deben tener una Descripción o Modelo.");
      return;
    }

    setLoading(true);

    try {
      const payload: StockCountInput = {
        id: initialData?.id,
        title,
        branch,
        performedBy: performedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
        items: items.map((i) => {
          const exp = Number(i.expectedQty) || 0;
          const cnt = Number(i.countedQty) || 0;
          return {
            code: i.code ? String(i.code).trim() : null,
            description: String(i.description).trim(),
            expectedQty: exp,
            countedQty: cnt,
            difference: cnt - exp,
            scannedImeis: i.scannedImeis ? String(i.scannedImeis).trim() : null,
            notes: i.notes ? String(i.notes).trim() : null,
          };
        }),
      };

      const res = await saveStockCountAction(payload);

      if (res.success) {
        clearDraft();
        onSuccess();
      } else {
        setErrorMessage(res.error || "Ocurrió un error al guardar el conteo");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcelPreview = () => {
    exportStockCountToExcel({
      countNumber: initialData?.id ? "BORRADOR" : "PREVIO",
      title: title || "Conteo de Inventario",
      branch,
      performedBy: performedBy || "Auditor",
      status: "IN_PROGRESS",
      notes,
      startedAt: new Date(),
      items: items.map((i) => ({
        code: i.code,
        description: i.description || "Modelo sin nombre",
        expectedQty: Number(i.expectedQty) || 0,
        countedQty: Number(i.countedQty) || 0,
        difference: (Number(i.countedQty) || 0) - (Number(i.expectedQty) || 0),
        scannedImeis: i.scannedImeis,
        notes: i.notes,
      })),
    });
  };

  const totalExpected = items.reduce((acc, item) => acc + (Number(item.expectedQty) || 0), 0);
  const totalCounted = items.reduce((acc, item) => acc + (Number(item.countedQty) || 0), 0);
  const totalDifference = totalCounted - totalExpected;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {initialData ? "Editar Conteo de Stock" : "Nuevo Conteo de Stock de Celulares"}
              </h2>
              <p className="text-xs text-slate-500">
                Auditoría física, escaneo rápido de IMEIs y comparación esperado vs. contado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSavedAt && !initialData && (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Borrador guardado ({lastSavedAt.toLocaleTimeString()})
              </span>
            )}
            <button
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Draft Restore Alert Banner */}
        {showDraftBanner && savedDraftData && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-amber-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-xs font-medium">
                Se encontró una auditoría de conteo guardada del{" "}
                <strong>{lastSavedAt ? lastSavedAt.toLocaleString() : "recientemente"}</strong>. ¿Deseas restaurarla?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRestoreDraft}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restaurar
              </button>
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Scanner Barcode Input */}
          <div className="bg-[#5750f1]/5 border border-[#5750f1]/20 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#5750f1] flex items-center gap-1.5 uppercase tracking-wider">
                <ScanLine className="w-4 h-4 text-[#5750f1] animate-pulse" /> Escáner Rápido de IMEI / Código de Barras
              </label>
              {scanSuccessMsg && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {scanSuccessMsg}
                </span>
              )}
            </div>

            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Escanea con la lectora o presiona ENTER (Ej: 356891092837461)..."
                  className="w-full bg-white border border-[#5750f1]/40 rounded-xl pl-9 pr-4 py-2 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/20"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-[#5750f1]/20 shrink-0"
              >
                <Zap className="w-4 h-4" /> Escanear (+1)
              </button>
            </form>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre / Título de la Auditoría <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Conteo Mensual de Celulares"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#5750f1]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sucursal / Almacén a Auditar
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5750f1]"
              >
                <option value="">Selecciona una sucursal activa</option>
                {branchesList.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Auditor / Responsable
              </label>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">Se asignará automáticamente desde la sesión activa.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Observaciones (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Revisión física de vitrina principal y almacén trasero"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
            />
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5750f1]" /> Detalle de Modelos & Cantidades Auditadas ({items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-[#5750f1]/10 hover:bg-[#5750f1]/20 text-[#5750f1] border border-[#5750f1]/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Agregar Modelo
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">SKU / Código</th>
                      <th className="px-3 py-2.5">Modelo / Descripción</th>
                      <th className="px-3 py-2.5 text-center w-28">Esperado</th>
                      <th className="px-3 py-2.5 text-center w-28">Contado Físico</th>
                      <th className="px-3 py-2.5 text-center w-28">Diferencia</th>
                      <th className="px-3 py-2.5">IMEIs Escaneados</th>
                      <th className="px-3 py-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const exp = Number(item.expectedQty) || 0;
                      const cnt = Number(item.countedQty) || 0;
                      const diff = cnt - exp;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={item.code || ""}
                              onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                              placeholder="SKU"
                              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-3 relative">
                            <input
                              type="text"
                              value={item.description || ""}
                              onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                              onFocus={() => setActiveSuggestionIndex(idx)}
                              placeholder="Ej. iPhone 15 Pro Max 256GB"
                              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#5750f1]"
                            />

                            {/* Dropdown Suggestions */}
                            {activeSuggestionIndex === idx && catalogSuggestions.length > 0 && (
                              <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-36 overflow-y-auto divide-y divide-slate-100">
                                {catalogSuggestions.map((sug, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => handleSelectSuggestion(idx, sug)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-[#5750f1]/10 hover:text-[#5750f1] font-medium"
                                  >
                                    {sug}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              value={item.expectedQty}
                              onChange={(e) => handleItemChange(idx, "expectedQty", e.target.value)}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-center font-bold text-slate-700 focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              value={item.countedQty}
                              onChange={(e) => handleItemChange(idx, "countedQty", e.target.value)}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-center font-extrabold text-[#5750f1] focus:outline-none focus:border-[#5750f1]"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`px-2.5 py-1 text-xs font-extrabold rounded-md border ${
                                diff === 0
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : diff > 0
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {diff === 0 ? "0 (OK)" : diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <textarea
                              rows={1}
                              value={item.scannedImeis || ""}
                              onChange={(e) => handleItemChange(idx, "scannedImeis", e.target.value)}
                              placeholder="Pegar IMEIs o escanear..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-mono text-emerald-800 focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Summary & Action Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-slate-700 w-full sm:w-auto">
            <div>
              <span className="text-slate-500 block font-medium">Esperado Total:</span>
              <span className="text-sm font-bold text-slate-800">{totalExpected} uds</span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Contado Físico:</span>
              <span className="text-sm font-extrabold text-[#5750f1]">{totalCounted} uds</span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Diferencia Total:</span>
              <span
                className={`text-sm font-extrabold ${
                  totalDifference === 0
                    ? "text-emerald-600"
                    : totalDifference > 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportExcelPreview}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit("IN_PROGRESS")}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Guardar Borrador
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit("COMPLETED")}
              className="px-5 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Finalizar Conteo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
