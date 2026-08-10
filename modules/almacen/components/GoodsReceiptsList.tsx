"use client";

import { useState, useEffect } from "react";
import {
  getGoodsReceiptsAction,
  deleteGoodsReceiptAction,
} from "../actions/goods-receipt";
import { GoodsReceiptForm } from "./GoodsReceiptForm";
import { GoodsReceiptDetailModal } from "./GoodsReceiptDetailModal";
import { exportReceiptListToExcel } from "@/lib/utils/excel-export";
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
  FileText,
  Clock,
  CheckCircle2,
  Inbox,
  Filter,
  Truck,
  PackageCheck,
} from "lucide-react";

export function GoodsReceiptsList() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState<any | null>(null);
  const [selectedReceiptForDetail, setSelectedReceiptForDetail] = useState<any | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    const res = await getGoodsReceiptsAction(searchQuery, statusFilter);
    if (res.success && res.data) {
      setReceipts(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReceipts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Deseas anular este recibo? Se conservará en el historial.")) {
      await deleteGoodsReceiptAction(id);
      fetchReceipts();
    }
  };

  const handleExportAllExcel = () => {
    exportReceiptListToExcel(
      receipts.map((r) => ({
        receiptNumber: r.receiptNumber,
        supplierName: r.supplierName,
        branch: r.branch,
        receivedBy: r.receivedBy || "Usuario",
        status: r.status,
        notes: r.notes,
        receivedAt: r.receivedAt || r.createdAt,
        items: r.items || [],
      }))
    );
  };

  // Métricas
  const totalReceipts = receipts.length;
  const completedReceipts = receipts.filter((r) => r.status === "COMPLETED").length;
  const draftReceipts = receipts.filter((r) => r.status === "DRAFT").length;
  const totalUnits = receipts.reduce(
    (acc, r) =>
      acc + (r.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Recibos de Mercancía
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de mercancía entrante, registro de IMEIs, borradores y exportación a Excel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportAllExcel}
            disabled={receipts.length === 0}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
          </button>

          <button
            onClick={() => {
              setSelectedReceiptForEdit(null);
              setShowFormModal(true);
            }}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuevo Recibo
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Total Recibos</span>
            <span className="text-2xl font-bold text-slate-800">{totalReceipts}</span>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Completados</span>
            <span className="text-2xl font-bold text-emerald-600">{completedReceipts}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Borradores Pendientes</span>
            <span className="text-2xl font-bold text-amber-600">{draftReceipts}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Unidades Recibidas</span>
            <span className="text-2xl font-bold text-[#5750f1]">{totalUnits} uds</span>
          </div>
          <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Folio, Proveedor, SKU o IMEI..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" /> Estado:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5750f1]"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="COMPLETED">Completados</option>
            <option value="DRAFT">Borradores</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
          <button
            onClick={fetchReceipts}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Recargar recibos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando recibos de mercancía...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">No se encontraron recibos de mercancía</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              No hay recibos registrados aún o la búsqueda no coincidió con ningún registro.
            </p>
            <button
              onClick={() => {
                setSelectedReceiptForEdit(null);
                setShowFormModal(true);
              }}
              className="mt-2 px-4 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#5750f1]/20"
            >
              <Plus className="w-4 h-4" /> Crear Primer Recibo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Folio Recibo</th>
                  <th className="px-4 py-3.5">Fecha</th>
                  <th className="px-4 py-3.5">Proveedor</th>
                  <th className="px-4 py-3.5">Sucursal</th>
                  <th className="px-4 py-3.5 text-center">Ítems / Uds</th>
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5">Registrado Por</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => {
                  const qty = (receipt.items || []).reduce(
                    (acc: number, i: any) => acc + (i.quantity || 1),
                    0
                  );
                  const formattedDate = new Date(
                    receipt.receivedAt || receipt.createdAt
                  ).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={receipt.id}
                      onClick={() => setSelectedReceiptForDetail(receipt)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-4 font-mono font-bold text-[#5750f1] group-hover:underline">
                        {receipt.receiptNumber}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formattedDate}</td>
                      <td className="px-4 py-4 font-bold text-slate-800">
                        {receipt.supplierName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {receipt.branch}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-800">
                        {receipt.items?.length || 0} ({qty} uds)
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                            receipt.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : receipt.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {receipt.status === "COMPLETED"
                            ? "COMPLETADO"
                            : receipt.status === "DRAFT"
                            ? "BORRADOR"
                            : "CANCELADO"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{receipt.receivedBy}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReceiptForDetail(receipt);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#5750f1] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {receipt.status !== "CANCELLED" ? <button
                            onClick={(e) => handleDelete(receipt.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Anular recibo"
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

      {/* Modal Form */}
      {showFormModal && (
        <GoodsReceiptForm
          initialData={selectedReceiptForEdit}
          onSuccess={() => {
            setShowFormModal(false);
            setSelectedReceiptForEdit(null);
            fetchReceipts();
          }}
          onCancel={() => {
            setShowFormModal(false);
            setSelectedReceiptForEdit(null);
          }}
        />
      )}

      {/* Modal Detail */}
      {selectedReceiptForDetail && (
        <GoodsReceiptDetailModal
          receipt={selectedReceiptForDetail}
          onClose={() => setSelectedReceiptForDetail(null)}
        />
      )}
    </div>
  );
}
