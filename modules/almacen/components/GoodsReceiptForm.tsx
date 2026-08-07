"use client";

import { useState, useEffect, useRef } from "react";
import {
  saveGoodsReceiptAction,
  getCatalogModelsAction,
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
};

const emptyItem = {
  code: "",
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
  const [branch, setBranch] = useState(initialData?.branch || "AlmacÃ©n Casita");
  const [receivedBy, setReceivedBy] = useState(initialData?.receivedBy || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [items, setItems] = useState<any[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((item: any) => ({
          ...item,
          colorVariants:
            item.colorVariants && item.colorVariants.length > 0
              ? item.colorVariants
              : [{ ...emptyColorVariant, imeis: item.imeiOrSerial || "" }],
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
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);

  // Lista de sucursales dinÃ¡micas desde BD
  const [branchesList, setBranchesList] = useState<any[]>([]);

  useEffect(() => {
    async function loadBranches() {
      const res = await getBranchesAction(true);
      if (res.success && res.data && res.data.length > 0) {
        setBranchesList(res.data);
      }
    }
    loadBranches();
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

  // Cargar catÃ¡logo de sugerencias al escribir
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
      setBranch(savedDraftData.branch || "Principal");
      setReceivedBy(savedDraftData.receivedBy || "");
      setNotes(savedDraftData.notes || "");
      if (savedDraftData.items && savedDraftData.items.length > 0) {
        setItems(
          savedDraftData.items.map((i: any) => ({
            ...i,
            colorVariants:
              i.colorVariants && i.colorVariants.length > 0
                ? i.colorVariants
                : [{ ...emptyColorVariant, imeis: i.imeiOrSerial || "" }],
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

  // Manejadores de Ã­tems de producto
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

  // Manejadores de Variantes de Color por Ãtem
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
      
      // Recalcular cantidad total del Ã­tem
      const newTotalQty = filteredVariants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 1), 0);

      updated[itemIndex] = {
        ...updated[itemIndex],
        colorVariants: filteredVariants,
        quantity: newTotalQty,
      };
      return updated;
    });
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
      currentVariants[variantIndex] = {
        ...currentVariants[variantIndex],
        [field]: value,
      };

      // Si el campo modificado es la cantidad o imeis, recalculamos la cantidad total del Ã­tem
      const newTotalQty = currentVariants.reduce((sum, v) => {
        const imeiCount = v.imeis ? v.imeis.split("\n").filter((s: string) => s.trim() !== "").length : 0;
        const qty = Number(v.quantity) || 1;
        return sum + Math.max(qty, imeiCount);
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

    const invalidItem = items.find((i) => !i.description || !i.description.trim());
    if (invalidItem) {
      setErrorMessage("Todos los Ã­tems deben tener un Modelo / DescripciÃ³n");
      return;
    }

    setLoading(true);

    try {
      const payload: GoodsReceiptInput = {
        id: initialData?.id,
        supplierName,
        branch,
        receivedBy: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
        items: items.map((i) => {
          // Consolidar IMEIs de todas las variantes de color para imeiOrSerial general
          const allImeis = (i.colorVariants || [])
            .map((v: any) => v.imeis)
            .filter(Boolean)
            .join("\n");

          const totalQty = (i.colorVariants || []).reduce(
            (sum: number, v: any) => sum + (Number(v.quantity) || 1),
            0
          );

          return {
            code: i.code ? String(i.code).trim() : null,
            description: String(i.description).trim(),
            quantity: Math.max(1, totalQty || Number(i.quantity) || 1),
            unitPrice: i.unitPrice !== undefined && i.unitPrice !== "" ? Number(i.unitPrice) : null,
            condition: i.condition || "Nuevo",
            imeiOrSerial: allImeis || i.imeiOrSerial || null,
            colorVariants: (i.colorVariants || []).map((v: any) => ({
              color: v.color || "General",
              quantity: Number(v.quantity) || 1,
              unitPrice: v.unitPrice ? Number(v.unitPrice) : null,
              imeis: v.imeis || null,
            })),
            notes: i.notes ? String(i.notes).trim() : null,
          };
        }),
      };

      const res = await saveGoodsReceiptAction(payload);

      if (res.success) {
        clearDraft();
        onSuccess();
      } else {
        setErrorMessage(res.error || "OcurriÃ³ un error al guardar el recibo");
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
        quantity: (i.colorVariants || []).reduce(
          (sum: number, v: any) => sum + (Number(v.quantity) || 1),
          0
        ) || Number(i.quantity) || 1,
        unitPrice: i.unitPrice ? Number(i.unitPrice) : 0,
        condition: i.condition || "Nuevo",
        imeiOrSerial: (i.colorVariants || []).map((v: any) => `${v.color ? v.color + ": " : ""}${v.imeis || ""}`).join(" | "),
        notes: i.notes,
      })),
    });
  };

  const totalQty = items.reduce((acc, item) => {
    const itemQty = (item.colorVariants || []).reduce(
      (sum: number, v: any) => sum + (Number(v.quantity) || 1),
      0
    );
    return acc + (itemQty || Number(item.quantity) || 1);
  }, 0);

  const totalAmount = items.reduce((acc, item) => {
    const itemSubtotal = (item.colorVariants || []).reduce(
      (sum: number, v: any) => sum + (Number(v.quantity) || 1) * (Number(v.unitPrice || item.unitPrice) || 0),
      0
    );
    return acc + itemSubtotal;
  }, 0);

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
                {initialData ? "Editar Recibo de MercancÃ­a" : "Nuevo Recibo de MercancÃ­a"}
              </h2>
              <p className="text-xs text-slate-500">
                Ingresa modelos, mÃºltiples colores e IMEIs separados por variante
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
                <strong>{lastSavedAt ? lastSavedAt.toLocaleString() : "recientemente"}</strong>. Â¿Deseas restaurarlo?
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
        Û®7¶‰žËkºwµçM½±½É½Õ¹Ñôí½±½É½Õ¹Ð€ôôô€Ä€ü€‰½±½Èˆ€è€‰½±½É•Ì‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰œµlŒÔÜÔÁ˜Åt¼ÄÀÑ•áÐµlŒÔÜÔÁ˜Åt™½¹Ðµ‰½±Áà´ÈÁä´À¸ÔÉ½Õ¹‘•µµˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥Ñ•µQ½Ñ…±EÑåôÕ‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆ½¹±¥¬õì¡”¤€ôø”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÑ½±•½±±…ÁÍ”¡¥Ñ•µ%‘à¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áÐµáÌ™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ÔÀÀ¡½Ù•ÈéÑ•áÐµlŒÔÜÔÁ˜ÅtÁà´ÈÁä´ÄÉ½Õ¹‘•¡½Ù•Èé‰œµÍ±…Ñ”´ÄÀÀÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌˆ(€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€í¥Í½±±…ÁÍ•€ü€‰‰É¥Èˆ€è€‰•ÉÉ…È‰ô(€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€í¥Ñ•µÌ¹±•¹Ñ €ø€Ä€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•I•µ½Ù•%Ñ•´¡¥Ñ•µ%‘à¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áÐµÍ±…Ñ”´ÐÀÀ¡½Ù•ÈéÑ•áÐµÉ•´ØÀÀÀ´Ä¸Ô¡½Ù•Èé‰œµÉ•´ÔÀÉ½Õ¹‘•µ±œÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥Ñ±”ô‰±¥µ¥¹…È•ÍÑ”µ½‘•±¼ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQÉ…Í È±…ÍÍ9…µ”ô‰Ü´Ð ´Ðˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€ì¼¨5½‘•°•Ñ…¥±Ì	½‘ä€¡M¡½Ý¸Ý¡•¸9=P½±±…ÁÍ•¤€¨½ô(€€€€€€€€€€€€€€€€€€€ì…¥Í½±±…ÁÍ•€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ðˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÄÍ´éÉ¥µ½±Ì´ÈµéÉ¥µ½±Ì´Ð…À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÅÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€M-T€¼Í‘¥¼€¡=Á¥½¹…°¤(€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí¥Ñ•´¹½‘”ñð€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø¡…¹‘±•%Ñ•µ¡…¹”¡¥Ñ•µ%‘à°€‰½‘”ˆ°”¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰¨¸%@ÄÕA4´ÈÔØˆ(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÝ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´Ä¸ÔÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´àÀÀÁ±…•¡½±‘•ÈµÍ±…Ñ”´ÐÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€ì¼¨ÕÑ½½µÁ±•Ñ”5½‘•°•ÍÉ¥ÁÑ¥½¸%¹ÁÕÐ€¨½ô(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µé½°µÍÁ…¸´ÈÉ•±…Ñ¥Ù”ˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÅÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´Ä™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù5½‘•±¼€¼•ÍÉ¥Á§Í¸€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÉ•´ÔÀÀˆø¨ð½ÍÁ…¸øð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÁÁátÑ•áÐµ•µ•É…±´ØÀÀ™½¹Ðµµ•‘¥Õ´™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñMÁ…É­±•Ì±…ÍÍ9…µ”ô‰Ü´Ì ´Ìˆ€¼øÕÑ¼µÕ…É‘„•¸…Ó…±½¼(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí¥Ñ•´¹‘•ÍÉ¥ÁÑ¥½¸ñð€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø¡…¹‘±••ÍÉ¥ÁÑ¥½¹¡…¹”¡¥Ñ•µ%‘à°”¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹½ÕÌõì ¤€ôøÍ•ÑÑ¥Ù•MÕ•ÍÑ¥½¹%¹‘•à¡¥Ñ•µ%‘à¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰¨¸¥A¡½¹”€ÄÔAÉ¼5…à€ÈÔÙˆ(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÝ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´Ä¸ÔÑ•áÐµáÌ™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´àÀÀÁ±…•¡½±‘•ÈµÍ±…Ñ”´ÐÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€€€€ì¼¨É½Á‘½Ý¸MÕ•ÍÑ¥½¹Ì€¨½ô(€€€€€€€€€€€€€€€€€€€€€€€í…Ñ¥Ù•MÕ•ÍÑ¥½¹%¹‘•à€ôôô¥Ñ•µ%‘à€˜˜…Ñ…±½MÕ•ÍÑ¥½¹Ì¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´ÀÉ¥¡Ð´ÀÑ½Àµ™Õ±°µÐ´Ä‰œµÝ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µá°Í¡…‘½Üµ±œè´ÌÀµ…àµ ´ÐÀ½Ù•É™±½Üµäµ…ÕÑ¼‘¥Ù¥‘”µä‘¥Ù¥‘”µÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í…Ñ…±½MÕ•ÍÑ¥½¹Ì¹µ…À ¡ÍÕœ°Í%‘à¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõíÍ%‘áô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•M•±•ÑMÕ•ÍÑ¥½¸¡¥Ñ•µ%‘à°ÍÕœ¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áÐµ±•™ÐÁà´ÌÁä´ÈÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´ÜÀÀ¡½Ù•Èé‰œµlŒÔÜÔÁ˜Åt¼ÄÀ¡½Ù•ÈéÑ•áÐµlŒÔÜÔÁ˜Åt™½¹Ðµµ•‘¥Õ´ÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÍÕôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÁÁátÑ•áÐµÍ±…Ñ”´ÐÀÀˆùMÕ•É•¹¥„ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÅÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´Äˆù½¹‘¥§Í¸ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍ•±•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí¥Ñ•´¹½¹‘¥Ñ¥½¸ñð€‰9Õ•Ù¼‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø¡…¹‘±•%Ñ•µ¡…¹”¡¥Ñ•µ%‘à°€‰½¹‘¥Ñ¥½¸ˆ°”¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÝ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´Ä¸ÔÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´àÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰9Õ•Ù¼ˆù9Õ•Ù¼ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰UÍ…‘¼€´á•±•¹Ñ”ˆùUÍ…‘¼€´á•±•¹Ñ”ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰UÍ…‘¼€´	Õ•¹¼ˆùUÍ…‘¼€´	Õ•¹¼ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰I•™ÕÉ‰¥Í¡•ˆùI•™ÕÉ‰¥Í¡•ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰A…É„I•ÁÕ•ÍÑ¼ˆùA…É„I•ÁÕ•ÍÑ¼ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€ì¼¨½±½ÉÌ€˜%5%ÌM•Ñ¥½¸€¨½ô(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÌÁÐ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸‰œµÍ±…Ñ”´ÄÀÀ¼àÀÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÅÁát™½¹Ðµ‰½±Ñ•áÐµÍ±…Ñ”´ÜÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñA…±•ÑÑ”±…ÍÍ9…µ”ô‰Ü´Ì¸Ô ´Ì¸ÔÑ•áÐµlŒÔÜÔÁ˜Åtˆ€¼øY…É¥…¹Ñ•Ì‘”½±½È”%5%ÌÁ…É„•ÍÑ”5½‘•±¼(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•‘‘½±½ÉY…É¥…¹Ð¡¥Ñ•µ%‘à¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áà´È¸ÔÁä´Ä‰œµÝ¡¥Ñ”¡½Ù•Èé‰œµÍ±…Ñ”´ÔÀÑ•áÐµlŒÔÜÔÁ˜Åt‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µµÑ•áÐµlÄÅÁát™½¹ÐµÍ•µ¥‰½±ÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÍ¡…‘½Ü´ÉáÌˆ(€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñA±ÕÌ±…ÍÍ9…µ”ô‰Ü´Ì¸Ô ´Ì¸Ôˆ€¼øÉ•…È½±½È(€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÌÁ°´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€ì¡¥Ñ•´¹½±½ÉY…É¥…¹ÑÌñðmt¤¹µ…À ¡Øè…¹ä°Ù%‘àè¹Õµ‰•È¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõíÙ%‘áô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÀ´ÌÍÁ…”µä´ÈÉ•±…Ñ¥Ù”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸Áˆ´Ä¸Ô‰½É‘•Èµˆ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÅÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½±½È€íÙ%‘à€¬€Åôè€ñÍÑÉ½¹œ±…ÍÍ9…µ”ô‰Ñ•áÐµÍ±…Ñ”´àÀÀˆùíØ¹½±½Èñð€‰M¥¸•ÍÁ•¥™¥…È‰ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥Ñ•´¹½±½ÉY…É¥…¹ÑÌ¹±•¹Ñ €ø€Ä€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•I•µ½Ù•½±½ÉY…É¥…¹Ð¡¥Ñ•µ%‘à°Ù%‘à¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áÐµÍ±…Ñ”´ÐÀÀ¡½Ù•ÈéÑ•áÐµÉ•´ØÀÀÀ´À¸ÔÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌÑ•áÐµlÄÁÁátˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥Ñ±”ô‰EÕ¥Ñ…È½±½Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQÉ…Í È±…ÍÍ9…µ”ô‰Ü´Ì¸Ô ´Ì¸Ôˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÄÍ´éÉ¥µ½±Ì´Ì…À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´À¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€9½µ‰É”‘•°½±½È€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÉ•´ÔÀÀˆø¨ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíØ¹½±½Èñð€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±•½±½ÉY…É¥…¹Ñ¡…¹”¡¥Ñ•µ%‘à°Ù%‘à°€‰½±½Èˆ°”¹Ñ…É•Ð¹Ù…±Õ”¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰¨¸éÕ°Q¥Ñ…¹¥„ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÍ±…Ñ”´ÔÀ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µµÁà´È¸ÔÁä´ÄÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´àÀÀÁ±…•¡½±‘•ÈµÍ±…Ñ”´ÐÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´À¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹Ñ¥‘…(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ¥¸õìÅô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíØ¹ÅÕ…¹Ñ¥Ñåô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±•½±½ÉY…É¥…¹Ñ¡…¹”¡¥Ñ•µ%‘à°Ù%‘à°€‰ÅÕ…¹Ñ¥Ñäˆ°”¹Ñ…É•Ð¹Ù…±Õ”¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÍ±…Ñ”´ÔÀ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µµÁà´È¸ÔÁä´ÄÑ•áÐµáÌ™½¹Ðµ‰½±Ñ•áÐµÍ±…Ñ”´àÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ØÀÀµˆ´À¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÍÑ¼U¹¥Ñ…É¥¼€¡I¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ¥¸õìÁô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ•ÀôˆÀ¸ÀÄˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíØ¹Õ¹¥ÑAÉ¥”€üü€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±•½±½ÉY…É¥…¹Ñ¡…¹”¡¥Ñ•µ%‘à°Ù%‘à°€‰Õ¹¥ÑAÉ¥”ˆ°”¹Ñ…É•Ð¹Ù…±Õ”¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•ÈôˆÀ¸ÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÍ±…Ñ”´ÔÀ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µµÁà´È¸ÔÁä´ÄÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´àÀÀÁ±…•¡½±‘•ÈµÍ±…Ñ”´ÐÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•ÈµlŒÔÜÔÁ˜Åtˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í´é½°µÍÁ…¸´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÍ±…Ñ”´ÜÀÀµˆ´À¸Ô™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ	…É½‘”±…ÍÍ9…µ”ô‰Ü´Ì ´ÌÑ•áÐµ•µ•É…±´ØÀÀˆ€¼ø%5%Ì€¼M•É¥•ÌÁ…É„•°½±½Éìˆ€‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œ±…ÍÍ9…µ”ô‰Ñ•áÐµ•µ•É…±´ÜÀÀˆùíØ¹½±½Èñð€‰Í•±•¥½¹…‘¼‰ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÑ•áÑ…É•„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É½ÝÌõìÉô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíØ¹¥µ•¥Ìñð€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±•½±½ÉY…É¥…¹Ñ¡…¹”¡¥Ñ•µ%‘à°Ù%‘à°€‰¥µ•¥Ìˆ°”¹Ñ…É•Ð¹Ù…±Õ”¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•ÈôˆÌÔØàäÄÀäÈàÌÜÐØÄ˜ŒÄÀìÌÔØàäÄÀäÈàÌÜÐØÈˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµÍ±…Ñ”´ÔÀ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µµÁà´È¸ÔÁä´ÄÑ•áÐµáÌ™½¹Ðµµ½¹¼Ñ•áÐµ•µ•É…±´àÀÀÁ±…•¡½±‘•ÈµÍ±…Ñ”´ÐÀÀ™½ÕÌé½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•Èµ•µ•É…±´ÔÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø((€€€€€€€ì¼¨½½Ñ•ÈMÕµµ…Éä€˜Ñ¥½¸½¹ÑÉ½±Ì€¨½ô(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ØÁä´Ð‰½É‘•ÈµÐ‰½É‘•ÈµÍ±…Ñ”´ÈÀÀ‰œµÍ±…Ñ”´ÔÀ™±•à™±•àµ½°Í´é™±•àµÉ½Ü¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Ðˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ØÑ•áÐµáÌÑ•áÐµÍ±…Ñ”´ÜÀÀÜµ™Õ±°Í´éÜµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ±…Ñ”´ÔÀÀ‰±½¬™½¹Ðµµ•‘¥Õ´ˆùQ½Ñ…°U¹¥‘…‘•Ìèð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹Ðµ‰½±Ñ•áÐµlŒÔÜÔÁ˜ÅtˆùíÑ½Ñ…±EÑåôÕ‘Ìð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€íÑ½Ñ…±µ½Õ¹Ð€ø€À€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ±…Ñ”´ÔÀÀ‰±½¬™½¹Ðµµ•‘¥Õ´ˆù5½¹Ñ¼ÍÑ¥µ…‘¼èð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹Ðµ‰½±Ñ•áÐµ•µ•É…±´ØÀÀˆø(€€€€€€€€€€€€€€€€€IíÑ½Ñ…±µ½Õ¹Ð¹Ñ½1½…±•MÑÉ¥¹œ ‰•Ìµ<ˆ°ìµ¥¹¥µÕµÉ…Ñ¥½¹¥¥ÑÌè€Èô¥ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È¸ÔÜµ™Õ±°Í´éÜµ…ÕÑ¼©ÕÍÑ¥™äµ•¹ˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€½¹±¥¬õí¡…¹‘±•áÁ½ÉÑá•±AÉ•Ù¥•Ýô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áà´Ì¸ÔÁä´È‰œµ•µ•É…±´ÔÀ¡½Ù•Èé‰œµ•µ•É…±´ÄÀÀÑ•áÐµ•µ•É…±´ÜÀÀ‰½É‘•È‰½É‘•Èµ•µ•É…±´ÈÀÀÉ½Õ¹‘•µá°Ñ•áÐµáÌ™½¹ÐµÍ•µ¥‰½±ÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ôˆ(€€€€€€€€€€€€€Ñ¥Ñ±”ô‰•Í…É…È‘…Ñ½Ì…ÑÕ…±•Ì•¸…É¡¥Ù¼á•°ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñ¥±•MÁÉ•…‘Í¡••Ð±…ÍÍ9…µ”ô‰Ü´Ð ´ÐÑ•áÐµ•µ•É…±´ØÀÀˆ€¼øá•°(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€‘¥Í…‰±•õí±½…‘¥¹ô(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•MÕ‰µ¥Ð ‰IPˆ¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áà´ÐÁä´È‰œµÝ¡¥Ñ”¡½Ù•Èé‰œµÍ±…Ñ”´ÄÀÀÑ•áÐµÍ±…Ñ”´ÜÀÀ‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÌÀÀÉ½Õ¹‘•µá°Ñ•áÐµáÌ™½¹ÐµÍ•µ¥‰½±ÑÉ…¹Í¥Ñ¥½¸µ½±½ÉÌ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ô‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñM…Ù”±…ÍÍ9…µ”ô‰Ü´Ð ´Ðˆ€¼øÕ…É‘…È	½ÉÉ…‘½È(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€‘¥Í…‰±•õí±½…‘¥¹ô(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•MÕ‰µ¥Ð ‰=5A1Qˆ¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áà´ÔÁä´È‰œµlŒÔÜÔÁ˜Åt¡½Ù•Èé‰œµlŒÐØÍ•ŒÕtÑ•áÐµÝ¡¥Ñ”É½Õ¹‘•µá°Ñ•áÐµáÌ™½¹Ðµ‰½±ÑÉ…¹Í¥Ñ¥½¸µ…±°Í¡…‘½ÜµµÍ¡…‘½ÜµlŒÔÜÔÁ˜Åt¼ÈÀ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ô‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€í±½…‘¥¹œ€ü€ (€€€€€€€€€€€€€€€€ñI•™É•Í¡Ü±…ÍÍ9…µ”ô‰Ü´Ð ´Ð…¹¥µ…Ñ”µÍÁ¥¸ˆ€¼ø(€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€ñ¡•­¥É±”È±…ÍÍ9…µ”ô‰Ü´Ð ´Ðˆ€¼ø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€¥¹…±¥é…ÈI•¥‰¼(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€¤ì)ô(