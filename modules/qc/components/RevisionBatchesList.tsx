"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRevisionBatchesAction } from "../actions/revision-batch";
import { NuevoLoteModal } from "./NuevoLoteModal";
import { AssignBatchModal } from "./AssignBatchModal";
import {
  Plus,
  Search,
  Building2,
  Calendar,
  Layers,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle2,
  Inbox,
  Filter,
  Package,
  ScanSearch,
  ArrowRight,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";

export function RevisionBatchesList({ isAdmin = false }: { isAdmin?: boolean }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [assignBatch, setAssignBatch] = useState<any>(null);

  const fetchBatches = async () => {
    setLoading(true);
    const res = await getRevisionBatchesAction(searchQuery, statusFilter);
    if (res.success && res.data) {
      setBatches(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBatches();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  // Métricas
  const totalBatches = batches.length;
  const inReviewBatches = batches.filter((b) => b.status === "IN_REVIEW" || b.status === "PENDING_REVIEW").length;
  const completedBatches = batches.filter((b) => b.status === "COMPLETED").length;
  const totalDevices = batches.reduce((acc, b) => acc + (b.totalDevices || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Superior */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Lotes de Revisión (Compras)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestión independiente de lotes recibidos de proveedores para auditoría y Control de Calidad
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuevo Lote de Revisión
          </button>
        )}
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Total Lotes</span>
            <span className="text-2xl font-bold text-slate-800">{totalBatches}</span>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">En Revisión / Pendientes</span>
            <span className="text-2xl font-bold text-amber-600">{inReviewBatches}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Lotes Completados</span>
            <span className="text-2xl font-bold text-emerald-600">{completedBatches}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-medium">Total Equipos Recibidos</span>
            <span className="text-2xl font-bold text-[#5750f1]">{totalDevices} uds</span>
          </div>
          <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Folio, Proveedor, Modelo o IMEI..."
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
            <option value="PENDING_REVIEW">Pendientes de Revisión</option>
            <option value="IN_REVIEW">En Revisión QC</option>
            <option value="COMPLETED">Completados</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
          <button
            onClick={fetchBatches}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Recargar lotes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabla de Lotes */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando Lotes de Revisión...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">
              {isAdmin ? "No se encontraron Lotes de Revisión" : "No tienes lotes asignados"}
            </h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              {isAdmin
                ? "Aún no hay compras o lotes de revisión registrados, o la búsqueda no arrojó resultados."
                : "El administrador asigna los lotes de compra; los que te asignen aparecerán aquí para que los revises."}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 px-4 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#5750f1]/20"
              >
                <Plus className="w-4 h-4" /> Crear Primer Lote
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Folio Lote</th>
                  <th className="px-4 py-3.5">Fecha Recepción</th>
                  <th className="px-4 py-3.5">Proveedor</th>
                  <th className="px-4 py-3.5">Sucursal</th>
                  <th className="px-4 py-3.5 text-center">Avance QC</th>
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5">Registrado Por</th>
                  <th className="px-4 py-3.5">Asignado a</th>
                  <th className="px-4 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => {
                  const formattedDate = new Date(
                    batch.receivedAt || batch.createdAt
                  ).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  const reviewedPercent =
                    batch.totalDevices > 0
                      ? Math.round(((batch.reviewedDevices || 0) / batch.totalDevices) * 100)
                      : 0;

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`/qc/lotes/${batch.id}`}
                          className="font-mono font-bold text-[#5750f1] hover:underline focus:outline-none"
                        >
                          {batch.batchNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formattedDate}</td>
                      <td className="px-4 py-4 font-bold text-slate-800">
                        {batch.supplierName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{batch.branch}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="w-32 mx-auto space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>{batch.reviewedDevices || 0} / {batch.totalDevices} uds</span>
                            <span>{reviewedPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="bg-[#5750f1] h-full transition-all duration-300"
                              style={{ width: `${reviewedPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                            batch.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : batch.status === "IN_REVIEW"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : batch.status === "PENDING_REVIEW"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {batch.status === "COMPLETED"
                            ? "COMPLETADO"
                            : batch.status === "IN_REVIEW"
                            ? "EN REVISIÓN"
                            : batch.status === "PENDING_REVIEW"
                            ? "PENDIENTE QC"
                            : "CANCELADO"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{batch.receivedBy}</td>
                      <td className="px-4 py-4">
                        {batch.assignedTo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5750f1]/10 text-[#5750f1] border border-[#5750f1]/20 text-[10px] font-bold">
                            <UserCheck className="w-3 h-3" />
                            {batch.assignedTo.name || batch.assignedTo.username || "QC"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setAssignBatch(batch)}
                              title={batch.assignedTo ? "Cambiar asignación" : "Asignar a QC"}
                              className={`p-1.5 rounded-lg text-xs transition-colors inline-flex items-center gap-1 ${
                                batch.assignedTo
                                  ? "bg-[#5750f1]/10 text-[#5750f1] hover:bg-[#5750f1] hover:text-white"
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-200"
                              }`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link
                            href={`/qc/lotes/${batch.id}`}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-[#5750f1] hover:text-white text-slate-700 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1"
                          >
                            Ver Detalle <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
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

      {/* Modal para crear nuevo lote */}
      {showModal && (
        <NuevoLoteModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchBatches();
          }}
        />
      )}

      {/* Modal para asignar lote a QC */}
      {assignBatch && (
        <AssignBatchModal
          batch={assignBatch}
          onClose={() => setAssignBatch(null)}
          onAssigned={() => {
            setAssignBatch(null);
            fetchBatches();
          }}
        />
      )}
    </div>
  );
}
