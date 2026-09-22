"use client";

import { useState, useEffect, useRef } from "react";
import { saveStockCountAction, applyStockCountToWarehouseAction } from "../actions/stock-count";
import { getWarehouseProductsAction } from "../actions/warehouse";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { StockCountInput } from "@/lib/validation/stock-count";
import { useStockCountDraft, getStoredStockCountDraft } from "../hooks/useStockCountDraft";
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
  Zap,
  ClipboardList,
  ScanLine,
  Boxes,
  CheckCheck,
  Search,
  Minus,
  Smartphone,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";

interface StockCountFormProps {
  initialData?: StockCountInput | null;
  onSuccess: () => void;
  onCancel: () => void;
  roleCode?: string;
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
  roleCode = "USER",
}: StockCountFormProps) {
  const { savedDraftData, hasSavedDraft, lastSavedAt, saveDraft, clearDraft } =
    useStockCountDraft();

  const [title, setTitle] = useState(
    initialData?.title || "Auditoría de Almacén General"
  );
  const [branch, setBranch] = useState(initialData?.branch || "");
  const [performedBy, setPerformedBy] = useState(initialData?.performedBy || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [items, setItems] = useState<any[]>(
    initialData?.items && initialData.items.length > 0
      ? [...initialData.items].sort((a: any, b: any) =>
          (a.description || "").localeCompare(b.description || "", "es", { sensitivity: "base" })
        )
      : []
  );

  const [loading, setLoading] = useState(false);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [branchesList, setBranchesList] = useState<any[]>([]);

  // Controles de búsqueda y filtros en móvil
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "MATCHED" | "DIFF">("ALL");

  // Escáner opcional
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
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

  // Cargar productos de almacén inicialmente para una auditoría nueva desde cero
  const handleLoadWarehouseProducts = async () => {
    try {
      setLoadingWarehouse(true);
      const res = await getWarehouseProductsAction();
      if (res.success && res.data && res.data.length > 0) {
        const productsWithStock = res.data.filter((p: any) => {
          const totalUnits = (p.boxes || 0) * (p.unitsPerBox || 1) + (p.looseUnits || 0);
          return totalUnits > 0;
        });

        const warehouseItems = productsWithStock.map((p: any) => {
          const brand = p.brand ? `${p.brand} ` : "";
          const name = p.name || "";
          const color = p.color ? ` ${p.color}` : "";
          const capacity = p.capacity ? ` ${p.capacity}` : "";
          const fullName = `${brand}${name}${color}${capacity}`.replace(/\s+/g, " ").trim();

          const expectedUnits = (p.boxes || 0) * (p.unitsPerBox || 1) + (p.looseUnits || 0);

          return {
            code: p.code || "",
            description: fullName,
            expectedQty: expectedUnits,
            countedQty: 0,
            difference: -expectedUnits,
            scannedImeis: "",
            notes: p.boxes > 0 ? `${p.boxes} cajas (${p.unitsPerBox} c/u) + ${p.looseUnits || 0} sueltas` : "",
          };
        });

        warehouseItems.sort((a: any, b: any) =>
          (a.description || "").localeCompare(b.description || "", "es", { sensitivity: "base" })
        );

        setItems(warehouseItems);
      }
    } catch (err: any) {
      console.error("Error al cargar productos de almacén:", err);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // Sincronizar existencias de almacén sin perder cantidades ya contadas ni IMEIs
  const handleSyncWithWarehouse = async () => {
    try {
      setLoadingWarehouse(true);
      setSyncNotice(null);
      setErrorMessage(null);
      const res = await getWarehouseProductsAction();
      if (res.success && res.data) {
        const warehouseProducts = res.data;
        const warehouseInfoList = warehouseProducts.map((p: any) => {
          const brand = p.brand ? `${p.brand} ` : "";
          const name = p.name || "";
          const color = p.color ? ` ${p.color}` : "";
          const capacity = p.capacity ? ` ${p.capacity}` : "";
          const fullName = `${brand}${name}${color}${capacity}`.replace(/\s+/g, " ").trim();
          const expectedUnits = (p.boxes || 0) * (p.unitsPerBox || 1) + (p.looseUnits || 0);
          const notes = p.boxes > 0 ? `${p.boxes} cajas (${p.unitsPerBox} c/u) + ${p.looseUnits || 0} sueltas` : "";

          return {
            product: p,
            code: (p.code || "").trim(),
            codeUpper: (p.code || "").trim().toUpperCase(),
            fullName,
            normalizedDesc: fullName.toLowerCase().replace(/\s+/g, " "),
            expectedUnits,
            notes,
          };
        });

        const matchedCodes = new Set<string>();
        const matchedIds = new Set<string>();
        let updatedCount = 0;

        // 1. Actualizar existencias esperadas de los items existentes conservando el conteo
        const updatedItems = items.map((item) => {
          const itemCode = (item.code || "").trim().toUpperCase();
          const itemDesc = (item.description || "").toLowerCase().replace(/\s+/g, " ").trim();

          const matched = warehouseInfoList.find((w) => {
            if (itemCode && w.codeUpper === itemCode) return true;
            if (itemDesc && w.normalizedDesc === itemDesc) return true;
            return false;
          });

          if (matched) {
            matchedCodes.add(matched.codeUpper);
            matchedIds.add(matched.product.id);
            const exp = matched.expectedUnits;
            const cnt = Number(item.countedQty) || 0;
            updatedCount++;
            return {
              ...item,
              code: item.code || matched.code,
              description: item.description || matched.fullName,
              expectedQty: exp,
              difference: cnt - exp,
              notes: matched.notes || item.notes,
            };
          }

          return item;
        });

        // 2. Incorporar nuevos modelos creados en almacén que tengan stock > 0
        let addedCount = 0;
        for (const w of warehouseInfoList) {
          if (!matchedCodes.has(w.codeUpper) && !matchedIds.has(w.product.id)) {
            if (w.expectedUnits > 0) {
              updatedItems.push({
                code: w.code,
                description: w.fullName,
                expectedQty: w.expectedUnits,
                countedQty: 0,
                difference: -w.expectedUnits,
                scannedImeis: "",
                notes: w.notes,
              });
              addedCount++;
            }
          }
        }

        updatedItems.sort((a: any, b: any) =>
          (a.description || "").localeCompare(b.description || "", "es", { sensitivity: "base" })
        );

        setItems(updatedItems);
        setSyncNotice(`Sincronización completada: existencias actualizadas (${updatedCount} modelos) y ${addedCount} modelos nuevos incorporados. Tus conteos se mantuvieron intactos.`);
      }
    } catch (err: any) {
      console.error("Error al sincronizar con almacén:", err);
      setErrorMessage("Error al sincronizar existencias de almacén");
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // Inicialización: Si el usuario cerró sin querer, recupera de inmediato su progreso
  useEffect(() => {
    if (initialData) {
      setIsInitialized(true);
      return;
    }

    const saved = getStoredStockCountDraft();
    if (saved && saved.formData && Array.isArray(saved.formData.items) && saved.formData.items.length > 0) {
      setTitle(saved.formData.title || "Auditoría de Almacén General");
      if (saved.formData.branch) setBranch(saved.formData.branch);
      if (saved.formData.notes) setNotes(saved.formData.notes);
      const draftItems = [...saved.formData.items].sort((a: any, b: any) =>
        (a.description || "").localeCompare(b.description || "", "es", { sensitivity: "base" })
      );
      setItems(draftItems);
      const savedTime = saved.savedAt
        ? new Date(saved.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      setResumedNotice(`Progreso recuperado automáticamente${savedTime ? ` (guardado a las ${savedTime})` : ""}`);
      setIsInitialized(true);
    } else {
      handleLoadWarehouseProducts().finally(() => {
        setIsInitialized(true);
      });
    }
  }, [initialData]);

  // Modificar cantidad contada de un producto
  const handleSetItemQty = (index: number, newQty: number | string) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const exp = Number(item.expectedQty) || 0;
      if (newQty === "") {
        item.countedQty = "";
        item.difference = 0 - exp;
      } else {
        const countVal = Math.max(0, Number(newQty) || 0);
        item.countedQty = countVal;
        item.difference = countVal - exp;
      }
      updated[index] = item;
      return updated;
    });
  };

  // Marcar todo como contado igual al esperado (para auditoría por excepción)
  const handleMatchAllAsCounted = () => {
    if (
      confirm(
        "¿Deseas marcar todas las cantidades contadas iguales al stock esperado del sistema? Luego podrás ajustar solo los que tengan diferencias."
      )
    ) {
      setItems((prev) =>
        prev.map((item) => {
          const exp = Number(item.expectedQty) || 0;
          return {
            ...item,
            countedQty: exp,
            difference: 0,
          };
        })
      );
    }
  };

  // Auto-guardado local debounced inmediato (solo después de haber inicializado)
  useEffect(() => {
    if (initialData || !isInitialized || items.length === 0) return;

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
    }, 400);

    return () => clearTimeout(timer);
  }, [title, branch, performedBy, notes, items, saveDraft, initialData, isInitialized]);

  // Protección si el usuario intenta recargar o cerrar el navegador con cantidades contadas
  useEffect(() => {
    const hasProgress = items.some((i) => (Number(i.countedQty) || 0) > 0);
    if (!hasProgress) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [items]);

  // Cierre seguro con confirmación y auto-guardado
  const handleSafeClose = () => {
    const hasProgress = items.some((i) => (Number(i.countedQty) || 0) > 0);
    if (hasProgress) {
      if (
        confirm(
          "Tu progreso ha quedado guardado en tu teléfono/dispositivo. Puedes salir tranquilo y continuar cuando vuelvas a abrir la auditoría. ¿Deseas salir ahora?"
        )
      ) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  // Reiniciar la auditoría de cero descartando el progreso previo
  const handleResetAudit = () => {
    if (
      confirm(
        "¿Deseas descartar los cambios en progreso y empezar una auditoría nueva desde cero con todos los productos en 0?"
      )
    ) {
      clearDraft();
      setResumedNotice(null);
      handleLoadWarehouseProducts();
    }
  };

  // Escaneo rápido opcional de código de barra
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scannedCode = scanInput.trim();
    if (!scannedCode) return;

    setScanSuccessMsg(null);

    let found = false;
    setItems((prev) => {
      return prev.map((item) => {
        if (
          (item.code && item.code.trim().toLowerCase() === scannedCode.toLowerCase()) ||
          (item.description && item.description.trim().toLowerCase().includes(scannedCode.toLowerCase()))
        ) {
          found = true;
          const updatedCount = Number(item.countedQty) + 1;
          setScanSuccessMsg(`+1 en "${item.description}"`);
          return {
            ...item,
            countedQty: updatedCount,
            difference: updatedCount - Number(item.expectedQty),
          };
        }
        return item;
      });
    });

    if (!found) {
      setScanSuccessMsg(`Código "${scannedCode}" no encontrado en el almacén.`);
    }

    setScanInput("");
    if (scanInputRef.current) scanInputRef.current.focus();
  };



  const handleAddItem = () => {
    setItems((prev) => [{ ...emptyItem }, ...prev]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === "expectedQty" || field === "countedQty") {
        const exp = Number(current.expectedQty) || 0;
        const cnt = Number(current.countedQty) || 0;
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

    const validItems = items.filter((i) => i.description && i.description.trim());
    if (validItems.length === 0) {
      setErrorMessage("Debes tener al menos un producto para registrar la auditoría.");
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
        items: validItems.map((i) => {
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
        if (status === "COMPLETED" && roleCode === "ADMIN" && res.data?.id) {
          const shouldApply = confirm(
            "Auditoría finalizada exitosamente.\n\n¿Deseas aplicar este conteo físico directamente al inventario de Almacén para que las existencias queden iguales?"
          );
          if (shouldApply) {
            try {
              const applyRes = await applyStockCountToWarehouseAction(res.data.id);
              if (applyRes.success) {
                alert(applyRes.message);
              } else {
                alert(`Conteo guardado, pero ocurrió un aviso al ajustar el almacén: ${applyRes.error}`);
              }
            } catch (applyErr: any) {
              alert(applyErr.message || "Error al sincronizar con almacén");
            }
          }
        }
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
      title: title || "Auditoría de Almacén",
      branch,
      performedBy: performedBy || "Auditor",
      status: "IN_PROGRESS",
      notes,
      startedAt: new Date(),
      items: items.map((i) => ({
        code: i.code,
        description: i.description || "Producto sin nombre",
        expectedQty: Number(i.expectedQty) || 0,
        countedQty: Number(i.countedQty) || 0,
        difference: (Number(i.countedQty) || 0) - (Number(i.expectedQty) || 0),
        scannedImeis: i.scannedImeis,
        notes: i.notes,
      })),
    });
  };

  // Cálculos globales
  const totalExpected = items.reduce((acc, item) => acc + (Number(item.expectedQty) || 0), 0);
  const totalCounted = items.reduce((acc, item) => acc + (Number(item.countedQty) || 0), 0);
  const totalDifference = totalCounted - totalExpected;

  const validItems = items.filter((i) => i.description && i.description.trim());
  const inOrderCount = validItems.filter((i) => (Number(i.countedQty) || 0) === (Number(i.expectedQty) || 0) && (Number(i.expectedQty) || 0) > 0).length;
  const pendingCount = validItems.filter((i) => (Number(i.countedQty) || 0) === 0 && (Number(i.expectedQty) || 0) > 0).length;
  const missingCount = validItems.filter((i) => (Number(i.countedQty) || 0) < (Number(i.expectedQty) || 0)).length;
  const excessCount = validItems.filter((i) => (Number(i.countedQty) || 0) > (Number(i.expectedQty) || 0)).length;
  const diffCount = validItems.filter((i) => (Number(i.countedQty) || 0) !== (Number(i.expectedQty) || 0)).length;

  // Filtrado de la lista para visualización
  const displayedItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const descMatch = item.description?.toLowerCase().includes(query);
        const codeMatch = item.code?.toLowerCase().includes(query);
        if (!descMatch && !codeMatch) return false;
      }

      const exp = Number(item.expectedQty) || 0;
      const cnt = Number(item.countedQty) || 0;
      const diff = cnt - exp;

      if (filterTab === "PENDING") {
        return cnt === 0 && exp > 0;
      }
      if (filterTab === "MATCHED") {
        return diff === 0 && (cnt > 0 || exp > 0);
      }
      if (filterTab === "DIFF") {
        return diff !== 0;
      }
      return true;
    })
    .sort((a, b) =>
      (a.item.description || "").localeCompare(b.item.description || "", "es", { sensitivity: "base" })
    );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-slate-50 text-slate-800 rounded-none sm:rounded-2xl w-full h-full sm:max-w-5xl sm:h-auto sm:max-h-[94vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-xl shrink-0">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                {initialData ? "Editar Auditoría" : "Auditoría de Almacén"}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="truncate">{branch || "Almacén General"}</span>
                {lastSavedAt && !initialData && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Guardado
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowScanner(!showScanner)}
              className={`p-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 border ${
                showScanner
                  ? "bg-[#5750f1] text-white border-[#5750f1]"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
              title="Escáner opcional"
            >
              <ScanLine className="w-4 h-4" />
              <span className="hidden sm:inline">Escáner</span>
            </button>

            <button
              onClick={handleSafeClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Resumed Progress Notice Banner */}
        {resumedNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-emerald-900 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate font-semibold">{resumedNotice}</span>
            </div>
            <button
              type="button"
              onClick={handleResetAudit}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors shrink-0 shadow-2xs"
            >
              Reiniciar de cero
            </button>
          </div>
        )}

        {/* Sync Warehouse Notice Banner */}
        {syncNotice && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center justify-between text-indigo-950 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-[#5750f1] shrink-0" />
              <span className="truncate font-semibold">{syncNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="p-1 text-indigo-600 hover:text-indigo-800 rounded-lg"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Scanner (Opcional colapsable) */}
        {showScanner && (
          <div className="bg-[#5750f1]/5 border-b border-[#5750f1]/20 p-3 shrink-0">
            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Escanear código de barra o modelo..."
                  className="w-full bg-white border border-[#5750f1]/30 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" /> +1
              </button>
            </form>
            {scanSuccessMsg && (
              <p className="text-[11px] font-semibold text-emerald-700 mt-1.5">
                {scanSuccessMsg}
              </p>
            )}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar producto por nombre, marca o código..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleMatchAllAsCounted}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              title="Marcar todo igual al esperado"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Todo en orden</span>
            </button>

            <button
              type="button"
              onClick={handleSyncWithWarehouse}
              disabled={loadingWarehouse}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#5750f1] border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              title="Sincronizar stock esperado con Almacén e incorporar modelos nuevos sin perder lo contado"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWarehouse ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar Almacén</span>
            </button>
          </div>

          {/* Filter Tabs (Mobile friendly horizontal scroll) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                filterTab === "ALL"
                  ? "bg-[#5750f1] text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              Todos ({validItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("PENDING")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                filterTab === "PENDING"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              Sin contar ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("MATCHED")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                filterTab === "MATCHED"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              En orden ({inOrderCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("DIFF")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
                filterTab === "DIFF"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              Diferencias ({diffCount})
            </button>
          </div>
        </div>

        {/* Product Cards List (Scrollable Area) */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loadingWarehouse ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#5750f1]" />
              <p className="text-xs font-bold text-slate-700">Cargando inventario de almacén...</p>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                {searchTerm ? "No se encontraron productos con esa búsqueda" : "No hay productos en este filtro"}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs font-bold text-[#5750f1] underline"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            displayedItems.map(({ item, originalIndex }) => {
              const exp = Number(item.expectedQty) || 0;
              const cnt = Number(item.countedQty) || 0;
              const diff = cnt - exp;

              return (
                <div
                  key={originalIndex}
                  className={`p-3.5 rounded-xl border transition-all ${
                    diff === 0 && (cnt > 0 || exp === 0)
                      ? "bg-white border-emerald-200/80 shadow-2xs"
                      : cnt === 0 && exp > 0
                      ? "bg-white border-slate-200"
                      : diff < 0
                      ? "bg-red-50/40 border-red-200"
                      : "bg-blue-50/40 border-blue-200"
                  }`}
                >
                  {/* Top Row: Description and Diff Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                        {item.description}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                        {item.code && (
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-slate-200/60">
                            {item.code}
                          </span>
                        )}
                        {item.notes && (
                          <span className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            {item.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 text-right">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border inline-flex items-center gap-1 ${
                          diff === 0 && (cnt > 0 || exp === 0)
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : cnt === 0 && exp > 0
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : diff < 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {diff === 0 && (cnt > 0 || exp === 0) ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cuadrado
                          </>
                        ) : cnt === 0 && exp > 0 ? (
                          "Sin contar"
                        ) : diff < 0 ? (
                          `Faltan ${Math.abs(diff)}`
                        ) : (
                          `Sobran +${diff}`
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Counter Control (Mobile-first large touch targets) */}
                  <div className="flex items-center justify-between pt-3 mt-2.5 border-t border-slate-100 gap-2">
                    <div className="text-left">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Sistema
                      </span>
                      <span className="text-sm font-extrabold text-slate-700">
                        {exp} <span className="text-[11px] font-medium text-slate-400">uds</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* One-tap Match Button */}
                      {cnt !== exp && (
                        <button
                          type="button"
                          onClick={() => handleSetItemQty(originalIndex, exp)}
                          className="h-10 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1 active:scale-95 shadow-2xs"
                          title="Fijar cantidad igual a lo esperado en sistema"
                        >
                          = {exp}
                        </button>
                      )}

                      {/* Touch Stepper Controls */}
                      <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSetItemQty(originalIndex, Math.max(0, cnt - 1))}
                          className="w-11 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-lg font-bold transition-colors active:bg-slate-200 select-none"
                          aria-label="Restar una unidad"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={item.countedQty === "" ? "" : item.countedQty ?? ""}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleSetItemQty(originalIndex, "");
                            } else {
                              const parsed = parseInt(val, 10);
                              handleSetItemQty(originalIndex, isNaN(parsed) ? "" : Math.max(0, parsed));
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === "") {
                              handleSetItemQty(originalIndex, 0);
                            }
                          }}
                          className="w-14 h-10 text-center text-base font-black text-[#5750f1] placeholder:text-slate-300 bg-transparent border-x border-slate-200 focus:outline-none focus:bg-indigo-50/30"
                        />

                        <button
                          type="button"
                          onClick={() => handleSetItemQty(originalIndex, cnt + 1)}
                          className="w-11 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-lg font-bold transition-colors active:bg-slate-200 select-none"
                          aria-label="Sumar una unidad"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Quick Add Product Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-[#5750f1] text-slate-600 hover:text-[#5750f1] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Agregar otro producto manualmente
            </button>
          </div>
        </div>

        {/* Sticky Mobile Summary & Action Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center justify-between w-full sm:w-auto sm:gap-6 text-xs text-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Esperado</span>
              <span className="text-sm font-bold text-slate-800">{totalExpected} uds</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Contado</span>
              <span className="text-sm font-extrabold text-[#5750f1]">{totalCounted} uds</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Diferencia</span>
              <span
                className={`text-sm font-black ${
                  totalDifference === 0
                    ? "text-emerald-600"
                    : totalDifference > 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {totalDifference === 0 ? "0 (OK)" : totalDifference > 0 ? `+${totalDifference}` : totalDifference}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportExcelPreview}
              className="p-2.5 sm:px-3.5 sm:py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              title="Descargar Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit("IN_PROGRESS")}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Borrador
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit("COMPLETED")}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-[#5750f1]/25 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
