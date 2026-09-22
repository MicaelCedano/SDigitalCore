"use client";

import { useState, useEffect } from "react";
import {
  getStockCountsAction,
  deleteStockCountAction,
  syncStockCountWithWarehouseAction,
  applyStockCountToWarehouseAction,
} from "../actions/stock-count";
import { StockCountForm } from "./StockCountForm";
import { StockCountDetailModal } from "./StockCountDetailModal";
import { exportStockCountListToExcel } from "@/lib/utils/excel-export-stock-count";
import Link from "next/link";
import {
  Plus,
  Search,
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  Eye,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Filter,
  ClipboardList,
  ScanLine,
  Pencil,
  Boxes,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function StockCountsList({ roleCode = "USER" }: { roleCode?: string }) {
  const [counts, setCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedCountForEdit, setSelectedCountForEdit] = useState<any | null>(null);
  const [selectedCountForDetail, setSelectedCountForDetail] = useState<any | null>(null);

  const fetchCounts = async () => {
    setLoading(true);
    const res = await getStockCountsAction(searchQuery, statusFilter);
    if (res.success && res.data) {
      setCounts(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    children?: React.ReactNode;
    confirmText?: string;
    cancelText?: string | null;
    variant?: "danger" | "warning" | "success" | "info" | "primary";
    isLoading?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogConfig({
      isOpen: true,
      title: "Anular Conteo de Stock",
      description: "¿Deseas anular este conteo? Se conservará en el historial marcado como cancelado.",
      confirmText: "Sí, anular",
      cancelText: "Volver",
      variant: "danger",
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isLoading: true }));
        try {
          await deleteStockCountAction(id);
          fetchCounts();
        } finally {
          setDialogConfig((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncCount = (id: string, countNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogConfig({
      isOpen: true,
      title: "Sincronizar existencias de almacén",
      description: `¿Deseas sincronizar la auditoría ${countNumber} con el stock actual de almacén?`,
      children: (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5 mt-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5750f1]"></span>
            Se actualizarán las cantidades esperadas según almacén.
          </p>
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5750f1]"></span>
            Se añadirán automáticamente nuevos modelos creados.
          </p>
          <p className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
            ✓ Tus conteos físicos ingresados se mantendrán intactos.
          </p>
        </div>
      ),
      confirmText: "Sincronizar ahora",
      cancelText: "Cancelar",
      variant: "primary",
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isLoading: true }));
        setSyncingId(id);
        try {
          const res = await syncStockCountWithWarehouseAction(id);
          if (res.success) {
            fetchCounts();
            setDialogConfig({
              isOpen: true,
              title: "Sincronización Exitosa",
              description: res.message || "Conteo sincronizado exitosamente con almacén.",
              confirmText: "Entendido",
              cancelText: null,
              variant: "success",
              onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
            });
          } else {
            setDialogConfig({
              isOpen: true,
              title: "Aviso de Sincronización",
              description: res.error || "No se pudo sincronizar el conteo con almacén.",
              confirmText: "Cerrar",
              cancelText: null,
              variant: "warning",
              onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: "Error de Sincronización",
            description: err.message || "Error al sincronizar con almacén.",
            confirmText: "Cerrar",
            cancelText: null,
            variant: "danger",
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setSyncingId(null);
        }
      },
    });
  };

  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApplyToWarehouse = (id: string, countNumber: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDialogConfig({
      isOpen: true,
      title: "Sincronizar Físico con Almacén",
      description: `¿Deseas aplicar el conteo físico de la auditoría ${countNumber} al inventario de Almacén?`,
      children: (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2 mt-2">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Acción exclusiva de Administrador:
          </div>
          <ul className="space-y-1.5 text-slate-700 pl-1">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Las existencias de cada modelo en Almacén pasarán a ser <strong>exactamente iguales a lo contado físicamente</strong>.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Se registrarán automáticamente los movimientos de ajuste (<strong>Entrada</strong> o <strong>Salida</strong>) en la bitácora.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold shrink-0">•</span>
              <span>Esta auditoría quedará cuadrada (<strong>diferencias = 0</strong>) y marcada como completada.</span>
            </li>
          </ul>
        </div>
      ),
      confirmText: "Sí, ajustar almacén",
      cancelText: "Cancelar",
      variant: "primary",
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isLoading: true }));
        setApplyingId(id);
        try {
          const res = await applyStockCountToWarehouseAction(id);
          if (res.success) {
            fetchCounts();
            if (selectedCountForDetail && selectedCountForDetail.id === id) {
              setSelectedCountForDetail(null);
            }
            setDialogConfig({
              isOpen: true,
              title: "Almacén Ajustado Exitosamente",
              description: res.message || "El inventario de almacén ahora coincide exactamente con el conteo físico.",
              confirmText: "Excelente",
              cancelText: null,
              variant: "success",
              onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
            });
          } else {
            setDialogConfig({
              isOpen: true,
              title: "Error al Ajustar Almacén",
              description: res.error || "No se pudo aplicar el ajuste al almacén.",
              confirmText: "Cerrar",
              cancelText: null,
              variant: "danger",
              onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: "Error Inesperado",
            description: err.message || "Error al procesar el ajuste",
            confirmText: "Cerrar",
            cancelText: null,
            variant: "danger",
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setApplyingId(null);
        }
      },
    });
  };

  const handleExportAllExcel = () => {
    exportStockCountListToExcel(
      counts.map((c) => ({
        countNumber: c.countNumber,
        title: c.title,
        branch: c.branch,
        performedBy: c.performedBy || "Auditor",
        status: c.status,
        notes: c.notes,
        startedAt: c.startedAt || c.createdAt,
        items: c.items || [],
      }))
    );
  };

  const completedCounts = counts.filter((c) => c.status === "COMPLETED").length;
  const inProgressCounts = counts.filter((c) => c.status === "IN_PROGRESS").length;
  const totalUnitsCounted = counts.reduce(
    (acc, c) =>
      acc + (c.items || []).reduce((sum: number, item: any) => sum + (item.countedQty || 0), 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Auditorías de Almacén & Conteos de Stock
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Control físico de existencias en almacén, comparación de esperado vs. contado y detección de discrepancias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
          <Link
            href="/almacen"
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Boxes className="w-4 h-4 text-slate-600" /> Ir a Productos
          </Link>
          <button
            onClick={handleExportAllExcel}
            disabled={counts.length === 0}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar a Excel
          </button>
          <button
            onClick={() => {
              setSelectedCountForEdit(null);
              setShowFormModal(true);
            }}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo Conteo
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Auditorías</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {counts.length}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-600 font-medium block">En Proceso (Borradores)</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {inProgressCounts}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-600 font-medium block">Auditorías Finalizadas</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {completedCounts}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5750f1] font-medium block">Unidades Físicas Contadas</span>
            <span className="text-2xl font-black text-[#5750f1] mt-1 block">
              {totalUnitsCounted} <span className="text-xs font-semibold text-slate-500">uds</span>
            </span>
          </div>
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <ScanLine className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por folio, modelo, IMEI o auditor..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5750f1]"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="IN_PROGRESS">En Proceso</option>
              <option value="COMPLETED">Completados</option>
            </select>
          </div>

          <button
            onClick={fetchCounts}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Refrescar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando conteos de stock...</p>
          </div>
        ) : counts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No se encontraron conteos de stock</p>
            <p className="text-xs text-slate-500">
              Presiona &quot;Nuevo Conteo&quot; para iniciar una auditoría física de inventario.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Folio Conteo</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Título / Auditoría</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3 text-center">Esperado vs Contado</th>
                  <th className="px-4 py-3 text-center">Diferencia</th>
                  <th className="px-4 py-3">Auditor</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {counts.map((c) => {
                  const formattedDate = new Date(c.startedAt || c.createdAt).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  const totalExpected = (c.items || []).reduce(
                    (sum: number, item: any) => sum + (item.expectedQty || 0),
                    0
                  );
                  const totalCounted = (c.items || []).reduce(
                    (sum: number, item: any) => sum + (item.countedQty || 0),
                    0
                  );
                  const diff = totalCounted - totalExpected;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCountForDetail(c)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-[#5750f1]">
                        {c.countNumber}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {c.title}
                        {c.items && c.items.length > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400 block font-normal mt-0.5">
                            {c.items.length} {c.items.length === 1 ? "modelo auditado" : "modelos auditados"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.branch}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="text-slate-500 font-semibold">{totalExpected}</span>{" "}
                        <span className="text-slate-300">/</span>{" "}
                        <span className="font-extrabold text-[#5750f1]">{totalCounted} uds</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-md border ${
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
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        {c.performedBy}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : c.status === "IN_PROGRESS"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {c.status === "COMPLETED"
                            ? "COMPLETADO"
                            : c.status === "IN_PROGRESS"
                            ? "EN PROCESO"
                            : "CANCELADO"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCountForDetail(c);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-[#5750f1]/10 text-slate-600 hover:text-[#5750f1] rounded-lg transition-colors"
                            title="Ver detalle de auditoría"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {c.status === "IN_PROGRESS" && (
                            <>
                              <button
                                onClick={(e) => handleSyncCount(c.id, c.countNumber, e)}
                                disabled={syncingId === c.id}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#5750f1] rounded-lg transition-colors"
                                title="Sincronizar existencias esperadas y agregar modelos nuevos desde Almacén"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncingId === c.id ? "animate-spin" : ""}`} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCountForEdit(c);
                                  setShowFormModal(true);
                                }}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                                title="Continuar / Editar borrador"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {roleCode === "ADMIN" && c.status !== "CANCELLED" && (
                            <button
                              onClick={(e) => handleApplyToWarehouse(c.id, c.countNumber, e)}
                              disabled={applyingId === c.id}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                              title="Sincronizar Almacén: Ajustar existencias con este conteo físico (Solo Admin)"
                            >
                              <SlidersHorizontal className={`w-4 h-4 ${applyingId === c.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          {c.status !== "CANCELLED" ? <button
                            onClick={(e) => handleDelete(c.id, e)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                            title="Anular conteo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <StockCountForm
          initialData={selectedCountForEdit}
          roleCode={roleCode}
          onSuccess={() => {
            setShowFormModal(false);
            fetchCounts();
          }}
          onCancel={() => setShowFormModal(false)}
        />
      )}

      {/* Detail Visor Modal */}
      {selectedCountForDetail && (
        <StockCountDetailModal
          count={selectedCountForDetail}
          roleCode={roleCode}
          onReconciled={() => fetchCounts()}
          onClose={() => setSelectedCountForDetail(null)}
        />
      )}

      {/* Modern Confirm & Notification Dialog */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={dialogConfig.onConfirm}
        title={dialogConfig.title}
        description={dialogConfig.description}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        variant={dialogConfig.variant}
        isLoading={dialogConfig.isLoading}
      >
        {dialogConfig.children}
      </ConfirmDialog>
    </div>
  );
}
