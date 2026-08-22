"use client";

import { useState, useEffect, useRef } from "react";
import {
  saveGoodsReceiptAction,
  getCatalogModelsAction,
  getGoodsReceiptSuggestionsAction,
} from "../actions/goods-receipt";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { GoodsReceiptInput } from "@/lib/validation/goods-receipt";
import { useGoodsReceiptDraft } from "../hooks/useGoodsReceiptDraft";
import { exportSingleReceiptToExcel } from "@/lib/utils/excel-export";
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
  Palette,
  Sparkles,
  PackageCheck,
  Truck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";

interface GoodsReceiptFormProps {
  initialData?: GoodsReceiptInput | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyColorVariant = {
  color: "",
  quantity: 1,
  unitPrice: undefined,
  imeis: "",
  withoutIdentifier: false,
};

const emptyItem = {
  code: "",
  brand: "",
  model: "",
  capacity: "",
  description: "",
  quantity: 1,
  unitPrice: undefined,
  condition: "Nuevo",
  imeiOrSerial: "",
  colorVariants: [{ ...emptyColorVariant }],
  notes: "",
};

export function GoodsReceiptForm({
  initialData,
  onSuccess,
  onCancel,
}: GoodsReceiptFormProps) {
  const { savedDraftData, hasSavedDraft, lastSavedAt, saveDraft, clearDraft } =
    useGoodsReceiptDraft();

  const [supplierName, setSupplierName] = useState(
    initialData?.supplierName || ""
  );
  const [branch, setBranch] = useState(initialData?.branch || "");
  const [receivedBy, setReceivedBy] = useState(initialData?.receivedBy || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [items, setItems] = useState<any[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((item: any) => ({
          ...item,
          model: item.model || item.colorVariants?.[0]?.model || item.description || "",
          brand: item.brand || item.colorVariants?.[0]?.brand || "",
          capacity: item.capacity || item.colorVariants?.[0]?.capacity || "",
          // A legacy receipt used description as its identity. Keep it visible
          // as model while leaving the new observations field separate.
          description: item.model || item.colorVariants?.[0]?.model ? item.description || "" : "",
          colorVariants:
            item.colorVariants && item.colorVariants.length > 0
              ? item.colorVariants.map((variant: any) => ({
                  ...variant,
                  withoutIdentifier: variant.withoutIdentifier ?? !variant.imeis,
                }))
              : [{ ...emptyColorVariant, imeis: item.imeiOrSerial || "", withoutIdentifier: !item.imeiOrSerial }],
        }))
      : [{ ...emptyItem }]
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(
    !initialData && hasSavedDraft
  );

  // Sugerencias de autocompletado para modelos
  const [catalogSuggestions, setCatalogSuggestions] = useState<string[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [colorSuggestions, setColorSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);

  // Lista de sucursales dinámicas desde BD
  const [branchesList, setBranchesList] = useState<any[]>([]);

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

  useEffect(() => {
    void getGoodsReceiptSuggestionsAction().then((res) => {
      if (!res.success) return;
      setSupplierSuggestions(res.data.suppliers);
      setColorSuggestions(res.data.colors);
    });
  }, []);

  // Estado para colapsar / desplegar modelos individualmente
  const [collapsedItems, setCollapsedItems] = useState<Record<number, boolean>>({});

  const toggleCollapse = (idx: number) => {
    setCollapsedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const collapseAll = () => {
    const allCollapsed: Record<number, boolean> = {};
    items.forEach((_, idx) => {
      allCollapsed[idx] = true;
    });
    setCollapsedItems(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedItems({});
  };

  // Cargar catálogo de sugerencias al escribir
  const handleDescriptionChange = async (index: number, val: string) => {
    handleItemChange(index, "model", val);
    setActiveSuggestionIndex(index);

    if (val.trim().length >= 1) {
      const res = await getCatalogModelsAction(val, items[index]?.brand);
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
        supplierName,
        branch,
        receivedBy,
        notes,
        status: "DRAFT",
        items: items.map((i) => ({
          ...i,
          quantity: Number(i.quantity) || 1,
          unitPrice: i.unitPrice ? Number(i.unitPrice) : undefined,
        })),
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [supplierName, branch, receivedBy, notes, items, saveDraft, initialData]);

  // Restaurar borrador guardado localmente
  const handleRestoreDraft = () => {
    if (savedDraftData) {
      setSupplierName(savedDraftData.supplierName || "");
      setBranch(savedDraftData.branch || "");
      setReceivedBy(savedDraftData.receivedBy || "");
      setNotes(savedDraftData.notes || "");
      if (savedDraftData.items && savedDraftData.items.length > 0) {
        setItems(
          savedDraftData.items.map((i: any) => ({
            ...i,
            model: i.model || i.colorVariants?.[0]?.model || i.description || "",
            brand: i.brand || i.colorVariants?.[0]?.brand || "",
            capacity: i.capacity || i.colorVariants?.[0]?.capacity || "",
            description: i.model || i.colorVariants?.[0]?.model ? i.description || "" : "",
            colorVariants:
              i.colorVariants && i.colorVariants.length > 0
                ? i.colorVariants.map((variant: any) => ({
                    ...variant,
                    withoutIdentifier: variant.withoutIdentifier ?? !variant.imeis,
                  }))
                : [{ ...emptyColorVariant, imeis: i.imeiOrSerial || "", withoutIdentifier: !i.imeiOrSerial }],
          }))
        );
      }
      setShowDraftBanner(false);
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
  };

  // Manejadores de ítems de producto
  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...emptyItem, colorVariants: [{ ...emptyColorVariant }] }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Manejadores de Variantes de Color por Ítem
  const handleAddColorVariant = (itemIndex: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const currentVariants = updated[itemIndex].colorVariants || [];
      updated[itemIndex] = {
        ...updated[itemIndex],
        colorVariants: [...currentVariants, { ...emptyColorVariant }],
      };
      return updated;
    });
  };

  const handleRemoveColorVariant = (itemIndex: number, variantIndex: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const currentVariants = updated[itemIndex].colorVariants || [];
      if (currentVariants.length <= 1) return prev;

      const filteredVariants = currentVariants.filter((_: any, vIdx: number) => vIdx !== variantIndex);
      
      // Recalcular cantidad total del ítem
      const newTotalQty = filteredVariants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 1), 0);

      updated[itemIndex] = {
        ...updated[itemIndex],
        colorVariants: filteredVariants,
        quantity: newTotalQty,
      };
      return updated;
    });
  };

  const countValidImeis = (text: string | null | undefined): number => {
    if (!text) return 0;
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0).length;
  };

  const handleColorVariantChange = (
    itemIndex: number,
    variantIndex: number,
    field: string,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const currentVariants = [...(updated[itemIndex].colorVariants || [])];
      
      const updatedVariant: any = {
        ...currentVariants[variantIndex],
        [field]: value,
      };

      if (field === "withoutIdentifier" && value === true) {
        updatedVariant.imeis = "";
      }

      if (field === "imeis") {
        const imeiCount = countValidImeis(value);
        if (imeiCount > 0) {
          updatedVariant.quantity = imeiCount;
          updatedVariant.withoutIdentifier = false;
        }
      }

      currentVariants[variantIndex] = updatedVariant;

      // Recalcular la cantidad total del ítem sumando variantes
      const newTotalQty = currentVariants.reduce((sum, v) => {
        const imeiCount = countValidImeis(v.imeis);
        const qty = Number(v.quantity) || 1;
        return sum + (imeiCount > 0 ? imeiCount : qty);
      }, 0);

      updated[itemIndex] = {
        ...updated[itemIndex],
        colorVariants: currentVariants,
        quantity: newTotalQty,
      };
      return updated;
    });
  };

  // Guardar Recibo
  const handleSubmit = async (status: "DRAFT" | "COMPLETED") => {
    setErrorMessage(null);

    if (!supplierName.trim()) {
      setErrorMessage("Por favor ingresa el nombre del Proveedor");
      return;
    }

    const invalidItem = items.find((i) => !i.model || !i.model.trim());
    if (invalidItem) {
      setErrorMessage("Todos los ítems deben tener un Modelo");
      return;
    }

    setLoading(true);

    try {
      const generalNotes = [
        notes.trim(),
        ...items.map((item) => String(item.description || "").trim()),
      ].filter(Boolean).join("\n");

      const payload: GoodsReceiptInput = {
        id: initialData?.id,
        supplierName,
        branch,
        receivedBy: receivedBy.trim() || undefined,
        notes: generalNotes || undefined,
        status,
        items: items.map((i) => {
          // Consolidar IMEIs de todas las variantes de color para imeiOrSerial general
          const allImeis = (i.colorVariants || [])
            .map((v: any) => v.imeis)
            .filter(Boolean)
            .join("\n");

          const totalQty = (i.colorVariants || []).reduce((sum: number, v: any) => {
            const imeiCount = countValidImeis(v.imeis);
            return sum + (imeiCount > 0 ? imeiCount : Number(v.quantity) || 1);
          }, 0);

          return {
            code: i.code ? String(i.code).trim() : null,
            brand: i.brand ? String(i.brand).trim() : null,
            model: String(i.model).trim(),
            capacity: i.capacity ? String(i.capacity).trim() : null,
            // La descripción del ítem es una observación del envío. La
            // identidad operativa queda en marca/modelo/capacidad y variantes.
            description: null,
            quantity: Math.max(1, totalQty || Number(i.quantity) || 1),
            unitPrice: null,
            condition: i.condition || "Nuevo",
            imeiOrSerial: allImeis || i.imeiOrSerial || null,
            colorVariants: (i.colorVariants || []).map((v: any) => {
              const vImeiCount = countValidImeis(v.imeis);
              return {
                brand: i.brand ? String(i.brand).trim() : null,
                model: String(i.model).trim(),
                capacity: i.capacity ? String(i.capacity).trim() : null,
                color: v.color && v.color.trim() ? v.color.trim() : null,
                quantity: vImeiCount > 0 ? vImeiCount : Number(v.quantity) || 1,
                unitPrice: null,
                imeis: v.imeis || null,
              };
            }),
            notes: i.notes ? String(i.notes).trim() : null,
          };
        }),
      };

      const res = await saveGoodsReceiptAction(payload);

      if (res.success) {
        clearDraft();
        onSuccess();
      } else {
        setErrorMessage(res.error || "Ocurrió un error al guardar el recibo");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  // Vista previa a Excel
  const handleExportExcelPreview = () => {
    exportSingleReceiptToExcel({
      receiptNumber: initialData?.id ? "BORRADOR" : "PREVIO",
      supplierName: supplierName || "Sin Proveedor",
      branch,
      receivedBy: receivedBy || "Usuario",
      status: "BORRADOR",
      notes,
      receivedAt: new Date(),
      items: items.map((i) => ({
        code: i.code,
        description: i.description || "Producto no especificado",
        quantity: (i.colorVariants || []).reduce((sum: number, v: any) => {
          const imeiCount = countValidImeis(v.imeis);
          return sum + (imeiCount > 0 ? imeiCount : Number(v.quantity) || 1);
        }, 0) || Number(i.quantity) || 1,
        unitPrice: 0,
        imeiOrSerial: (i.colorVariants || []).map((v: any) => v.imeis || "").filter(Boolean).join("\n"),
        notes: i.notes,
        colorVariants: i.colorVariants,
      })),
    });
  };

  const totalQty = items.reduce((acc, item) => {
    const itemQty = (item.colorVariants || []).reduce((sum: number, v: any) => {
      const imeiCount = countValidImeis(v.imeis);
      return sum + (imeiCount > 0 ? imeiCount : Number(v.quantity) || 1);
    }, 0);
    return acc + (itemQty || Number(item.quantity) || 1);
  }, 0);

  const totalAmount = 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {initialData ? "Editar Recibo de Mercancía" : "Nuevo Recibo de Mercancía"}
              </h2>
              <p className="text-xs text-slate-500">
                Registra la cantidad directamente cuando el equipo no tenga IMEI ni número de serie
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
                Existe un borrador guardado del{" "}
                <strong>{lastSavedAt ? lastSavedAt.toLocaleString() : "recientemente"}</strong>. ¿Deseas restaurarlo?
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

          {/* General Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Proveedor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej. Distribuidora Celulares RD"
                list="receipt-supplier-suggestions"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 transition-colors"
              />
              <datalist id="receipt-supplier-suggestions">
                {supplierSuggestions.map((supplier) => <option key={supplier} value={supplier} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sucursal / Almacén Destino
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5750f1] transition-colors"
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
                Recibido / Registrado Por
              </label>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">Se asignará automáticamente desde la sesión activa.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Observaciones Generales (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Paquete sellado recibido por envío expreso sin daños físicos"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 transition-colors"
            />
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5750f1]" /> Modelos & Colores Recibidos ({items.length})
              </h3>
              <div className="flex items-center gap-2">
                {items.length > 1 && (
                  <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-100 rounded-md transition-colors"
                      title="Colapsar todos los modelos"
                    >
                      <ChevronUp className="w-3.5 h-3.5" /> Colapsar Todos
                    </button>
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-100 rounded-md transition-colors"
                      title="Expandir todos los modelos"
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5" /> Expandir
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-1.5 bg-[#5750f1]/10 hover:bg-[#5750f1]/20 text-[#5750f1] border border-[#5750f1]/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4" /> Agregar Modelo
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item, itemIdx) => {
                const isCollapsed = !!collapsedItems[itemIdx];
                const colorCount = (item.colorVariants || []).length;
                const itemTotalQty = (item.colorVariants || []).reduce(
                  (sum: number, v: any) => sum + (Number(v.quantity) || 1),
                  0
                );

                return (
                  <div
                    key={itemIdx}
                    className={`bg-slate-50/90 border rounded-xl shadow-2xs transition-all ${
                      isCollapsed ? "border-slate-300 bg-white" : "border-slate-200 p-4 space-y-4"
                    }`}
                  >
                    {/* Collapsible Header Bar */}
                    <div
                      onClick={() => toggleCollapse(itemIdx)}
                      className={`flex items-center justify-between cursor-pointer select-none transition-colors ${
                        isCollapsed ? "px-4 py-3 hover:bg-slate-50 rounded-xl" : "pb-3 border-b border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 text-slate-400 group-hover:text-slate-600">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-[#5750f1]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#5750f1]" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-[#5750f1] bg-[#5750f1]/10 px-2.5 py-0.5 rounded-full border border-[#5750f1]/20">
                          Modelo #{itemIdx + 1}
                        </span>

                        <span className="text-xs font-bold text-slate-800">
                          {item.model ? `${item.brand ? `${item.brand} ` : ""}${item.model}${item.capacity ? ` ${item.capacity}` : ""}` : <span className="text-slate-400 italic">Escribir marca y modelo...</span>}
                        </span>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="bg-slate-200/70 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                            {colorCount} {colorCount === 1 ? "color" : "colores"}
                          </span>
                          <span className="bg-[#5750f1]/10 text-[#5750f1] font-bold px-2 py-0.5 rounded-md">
                            {itemTotalQty} uds
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleCollapse(itemIdx)}
                          className="text-xs font-semibold text-slate-500 hover:text-[#5750f1] px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          {isCollapsed ? "Abrir" : "Cerrar"}
                        </button>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(itemIdx)}
                            className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar este modelo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Model Details Body (Shown when NOT collapsed) */}
                    {!isCollapsed && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          SKU / Código (Opcional)
                        </label>
                        <input
                          type="text"
                          value={item.code || ""}
                          onChange={(e) => handleItemChange(itemIdx, "code", e.target.value)}
                          placeholder="Ej. IP15PM-256"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                        />
                      </div>

                      <div className="relative">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Marca <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={item.brand || ""}
                          onChange={(e) => handleItemChange(itemIdx, "brand", e.target.value)}
                          placeholder="Ej. Samsung"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                        />
                      </div>

                      {/* Autocomplete Model Input */}
                      <div className="relative">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                          <span>Modelo <span className="text-red-500">*</span></span>
                          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Auto-guarda en catálogo
                          </span>
                        </label>
                        <input
                          type="text"
                          value={item.model || ""}
                          onChange={(e) => handleDescriptionChange(itemIdx, e.target.value)}
                          onFocus={() => setActiveSuggestionIndex(itemIdx)}
                          placeholder="Ej. iPhone 15 Pro Max"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                        />

                        {/* Dropdown Suggestions */}
                        {activeSuggestionIndex === itemIdx && catalogSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto divide-y divide-slate-100">
                            {catalogSuggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleSelectSuggestion(itemIdx, sug)}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-[#5750f1]/10 hover:text-[#5750f1] font-medium transition-colors flex items-center justify-between"
                              >
                                <span>{sug}</span>
                                <span className="text-[10px] text-slate-400">Sugerencia</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Capacidad</label>
                        <input
                          type="text"
                          value={item.capacity || ""}
                          onChange={(e) => handleItemChange(itemIdx, "capacity", e.target.value)}
                          placeholder="Ej. 8+256GB"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                        />
                      </div>

                      <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observación del envío (opcional)</label>
                        <input
                          type="text"
                          value={item.description || ""}
                          onChange={(e) => handleItemChange(itemIdx, "description", e.target.value)}
                          placeholder="Ej. algunos equipos llegaron sin caja"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Condición</label>
                        <select
                          value={item.condition || "Nuevo"}
                          onChange={(e) => handleItemChange(itemIdx, "condition", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                        >
                          <option value="Nuevo">Nuevo</option>
                          <option value="Usado - Excelente">Usado - Excelente</option>
                          <option value="Usado - Bueno">Usado - Bueno</option>
                          <option value="Refurbished">Refurbished</option>
                          <option value="Para Repuesto">Para Repuesto</option>
                        </select>
                      </div>
                    </div>

                    {/* Colors & IMEIs Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5 text-[#5750f1]" /> Variantes de color e identificación
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddColorVariant(itemIdx)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#5750f1] border border-slate-200 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar Color
                        </button>
                      </div>

                      <div className="space-y-3 pl-2">
                        {(item.colorVariants || []).map((v: any, vIdx: number) => (
                          <div
                            key={vIdx}
                            className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                                Color #{vIdx + 1}: <strong className="text-slate-800">{v.color || "Sin especificar"}</strong>
                              </span>
                              {item.colorVariants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColorVariant(itemIdx, vIdx)}
                                  className="text-slate-400 hover:text-red-600 p-0.5 transition-colors text-[10px]"
                                  title="Quitar color"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                  Nombre del Color <span className="text-slate-400 font-normal">(Opcional)</span>
                                </label>
                                <input
                                  type="text"
                                  value={v.color || ""}
                                  list={`receipt-color-suggestions-${itemIdx}-${vIdx}`}
                                  onChange={(e) =>
                                    handleColorVariantChange(itemIdx, vIdx, "color", e.target.value)
                                  }
                                  placeholder="Ej. Azul Titania (ó General)"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                                />
                                <datalist id={`receipt-color-suggestions-${itemIdx}-${vIdx}`}>
                                  {colorSuggestions.map((color) => <option key={color} value={color} />)}
                                </datalist>
                              </div>

                              <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-800 sm:col-span-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(v.withoutIdentifier)}
                                  onChange={(e) =>
                                    handleColorVariantChange(itemIdx, vIdx, "withoutIdentifier", e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 accent-amber-600"
                                />
                                Este producto no tiene IMEI ni número de serie
                                <span className="font-normal text-amber-700">(TV, bocina, cargador, etc.)</span>
                              </label>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5 flex items-center justify-between">
                                  <span>Cantidad</span>
                                  {countValidImeis(v.imeis) > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-600">
                                      Calculada por IMEIs ({countValidImeis(v.imeis)} uds)
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={countValidImeis(v.imeis) > 0 ? countValidImeis(v.imeis) : (v.quantity || 1)}
                                  onChange={(e) =>
                                    handleColorVariantChange(itemIdx, vIdx, "quantity", e.target.value)
                                  }
                                  disabled={countValidImeis(v.imeis) > 0}
                                  className={`w-full border rounded-md px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5750f1] ${
                                    countValidImeis(v.imeis) > 0
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 cursor-not-allowed"
                                      : "bg-slate-50 border-slate-200"
                                  }`}
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-semibold text-slate-700 mb-0.5 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Barcode className="w-3 h-3 text-emerald-600" /> IMEIs / Series para el color{" "}
                                    <strong className="text-emerald-700">{v.color || "General"}</strong>
                                  </span>
                                  {countValidImeis(v.imeis) > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                      {countValidImeis(v.imeis)} {countValidImeis(v.imeis) === 1 ? "IMEI detectado" : "IMEIs detectados"}
                                    </span>
                                  )}
                                </label>
                                <textarea
                                  rows={2}
                                  value={v.imeis || ""}
                                  onChange={(e) =>
                                    handleColorVariantChange(itemIdx, vIdx, "imeis", e.target.value)
                                  }
                                  placeholder={v.withoutIdentifier ? "No aplica: registra la cantidad arriba" : "Pegar o escanear IMEIs (uno por línea o separados por comas)"}
                                  disabled={Boolean(v.withoutIdentifier)}
                                  className={`w-full border rounded-md px-2.5 py-1 text-xs font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-500 ${v.withoutIdentifier ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700" : "bg-slate-50 border-slate-200 text-emerald-800"}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
              })}
            </div>
          </div>
        </div>

        {/* Footer Summary & Action Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-slate-700 w-full sm:w-auto">
            <div>
              <span className="text-slate-500 block font-medium">Total Unidades:</span>
              <span className="text-sm font-bold text-[#5750f1]">{totalQty} uds</span>
            </div>
            {totalAmount > 0 && (
              <div>
                <span className="text-slate-500 block font-medium">Monto Estimado:</span>
                <span className="text-sm font-bold text-emerald-600">
                  RD$ {totalAmount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportExcelPreview}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              title="Descargar datos actuales en archivo Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit("DRAFT")}
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
              Finalizar Recibo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

