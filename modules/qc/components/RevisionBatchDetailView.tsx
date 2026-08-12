"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateRevisionBatchStatusAction,
  getRevisionBatchDetailAction,
  deleteRevisionBatchAction,
} from "../actions/revision-batch";
import { ReviewDeviceModal } from "./ReviewDeviceModal";
import { AssignDeviceModal } from "./AssignDeviceModal";
import { FisicoVerifierModal } from "./FisicoVerifierModal";
import { NoFuncionalesModal } from "./NoFuncionalesModal";
import { AddDevicesModal } from "./AddDevicesModal";
import {
  ArrowLeft,
  Package,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ScanSearch,
  Search,
  Check,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  CheckCheck,
  ClipboardCheck,
  UserCheck,
  Fingerprint,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";

interface RevisionBatchDetailViewProps {
  batch: any;
  isAdmin?: boolean;
}

export function RevisionBatchDetailView({ batch: initialBatch, isAdmin = false }: RevisionBatchDetailViewProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewDevice, setReviewDevice] = useState<any>(null);
  const [assignDevice, setAssignDevice] = useState<any>(null);
  const [showVerifier, setShowVerifier] = useState(false);
  const [showNoFuncionales, setShowNoFuncionales] = useState(false);
  const [showAddDevices, setShowAddDevices] = useState(false);
  const router = useRouter();

  const refreshBatch = async () => {
    const res = await getRevisionBatchDetailAction(batch.id);
    if (res.success && res.data) setBatch(res.data);
  };

  const handleStatusChange = async (newStatus: "PENDING_REVIEW" | "IN_REVIEW" | "COMPLETED" | "CANCELLED") => {
    if (!confirm(`¿Desea cambiar el estado del Lote ${batch.batchNumber} a "${newStatus}"?`)) return;

    setLoadingStatus(true);
    const res = await updateRevisionBatchStatusAction({ id: batch.id, status: newStatus });
    setLoadingStatus(false);

    if (res.success && res.data) {
      setBatch((prev: any) => ({ ...prev, status: res.data.status, completedAt: res.data.completedAt }));
    } else {
      alert(res.error || "No se pudo actualizar el estado del lote.");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la compra ${batch.batchNumber} por completo? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const res = await deleteRevisionBatchAction({ id: batch.id });
    setDeleting(false);
    if (res.success) {
      alert(res.message ?? "Compra eliminada.");
      router.push("/qc/lotes");
      router.refresh();
    } else {
      alert(res.error || "No se pudo eliminar la compra.");
    }
  };

  // Filtrar equipos del lote
  const devices = (batch.devices || []).filter((dev: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (dev.imei && dev.imei.toLowerCase().includes(q)) ||
      (dev.serialNumber && dev.serialNumber.toLowerCase().includes(q)) ||
      (dev.model && dev.model.toLowerCase().includes(q)) ||
      (dev.brand && dev.brand.toLowerCase().includes(q)) ||
      (dev.color && dev.color.toLowerCase().includes(q))
    );
  });

  const formattedDate = new Date(batch.receivedAt || batch.createdAt).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const reviewedPercent =
    batch.totalDevices > 0
      ? Math.round(((batch.reviewedDevices || 0) / batch.totalDevices) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <div>
        <Link
          href="/qc/lotes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#5750f1] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Lotes de Revisión
        </Link>
      </div>

      {/* Header del Lote */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-[#5750f1]/10 text-[#5750f1] rounded-2xl border border-[#5750f1]/20 shrink-0">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-mono">
                {batch.batchNumber}
              </h1>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full border ${
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
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-slate-700">Proveedor: {batch.supplierName}</span>
              <span>•</span>
              <span>Sucursal: {batch.branch}</span>
              <span>•</span>
              <span>Fecha: {formattedDate}</span>
              <span>•</span>
              <span>Registrado por: {batch.receivedBy}</span>
            </p>
            {batch.notes && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 border border-slate-200">
                <span className="font-bold">Notas:</span> {batch.notes}
              </p>
            )}
          </div>
        </div>

        {/* Acciones: admin gestiona la compra (verificar/recuperar/eliminar);
            el control de calidad gestiona los estados del lote */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {isAdmin ? (
            <>
              <button
                onClick={() => setShowVerifier(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                <Fingerprint className="w-4 h-4" /> Verificador Físico
              </button>
              <button
                onClick={() => setShowNoFuncionales(true)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-100 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> No Funcionales
                {batch.nonFunctionalCount > 0 ? (
                  <span className="rounded-full bg-rose-600 text-white text-[10px] font-black px-1.5 min-w-[18px] text-center">{batch.nonFunctionalCount}</span>
                ) : null}
              </button>
              <button
                onClick={() => setShowAddDevices(true)}
                className="px-4 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Agregar Equipos
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || batch.status === "COMPLETED"}
                title={batch.status === "COMPLETED" ? "No se puede eliminar un lote completado" : "Eliminar la compra por completo"}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar Compra
              </button>
            </>
          ) : (
            <>
              {batch.status !== "COMPLETED" && (
                <button
                  onClick={() => handleStatusChange("COMPLETED")}
                  disabled={loadingStatus}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" /> Marcar Lote Completado
                </button>
              )}

              {batch.status === "PENDING_REVIEW" && (
                <button
                  onClick={() => handleStatusChange("IN_REVIEW")}
                  disabled={loadingStatus}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" /> Iniciar Revisión
                </button>
              )}

              {batch.status !== "CANCELLED" && (
                <button
                  onClick={() => handleStatusChange("CANCELLED")}
                  disabled={loadingStatus}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold text-xs rounded-xl transition-colors"
                >
                  Anular Lote
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen & Avance QC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Total Equipos</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{batch.totalDevices}</span>
            <span className="text-xs font-bold text-slate-400">100%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Equipos Revisados</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#5750f1]">
              {batch.reviewedDevices || 0} / {batch.totalDevices}
            </span>
            <span className="text-xs font-bold text-[#5750f1]">{reviewedPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#5750f1] h-full transition-all duration-300"
              style={{ width: `${reviewedPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Funcionales (Aprobados)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">{batch.functionalCount || 0}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Defectuosos (Fallas)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-red-600">{batch.nonFunctionalCount || 0}</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda de Equipos dentro del Lote */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar dentro del lote por IMEI, Serie o Modelo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Mostrando <span className="font-bold text-slate-800">{devices.length}</span> de {batch.totalDevices} equipos
        </div>
      </div>

      {/* Tabla de Equipos del Lote */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {devices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-xs font-semibold">No hay equipos que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">IMEI / Serie</th>
                  <th className="px-4 py-3.5">Modelo</th>
                  <th className="px-4 py-3.5">Color / Capacidad</th>
                  <th className="px-4 py-3.5 text-center">Estado Operativo</th>
                  <th className="px-4 py-3.5 text-center">Resultado QC</th>
                  <th className="px-4 py-3.5 text-center">Grado / Batería</th>
                  <th className="px-4 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((dev: any) => {
                  const lastInspection = dev.inspections?.[0];
                  const hasQC = lastInspection && lastInspection.status === "COMPLETED";

                  return (
                    <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-mono font-bold text-slate-800">
                        {dev.imei || dev.serialNumber || "Sin Identificador"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {dev.brand} {dev.model}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {dev.color || "—"} {dev.storageGb ? `/ ${dev.storageGb}GB` : ""}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {dev.status}
                          </span>
                          {dev.hasPreviousQC ? (
                            <span
                              title="Equipo reingresado: conserva historial de revisiones anteriores, se revisa desde cero en este lote"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              REINGRESADO
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {hasQC ? (
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                              lastInspection.result === "FUNCTIONAL"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {lastInspection.result === "FUNCTIONAL" ? "FUNCIONAL" : "DEFECTUOSO"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            PENDIENTE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600 font-medium">
                        {hasQC ? (
                          <span>
                            Grado {lastInspection.grade || "A"} • {lastInspection.batteryHealth || "--"}%
                          </span>
                        ) : (
                          " — "
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAssignDevice(dev)}
                            title={dev.assignedToId ? "Cambiar asignación" : "Asignar IMEI a QC"}
                            className="p-1.5 bg-slate-100 hover:bg-[#5750f1] hover:text-white text-slate-700 rounded-lg text-xs transition-colors inline-flex items-center"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewDevice(dev)}
                            className="px-2.5 py-1.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" /> Revisar
                          </button>
                          <Link
                            href={`/qc/equipos-revisados?q=${dev.imei || dev.serialNumber || ""}`}
                            title="Ver en equipos revisados"
                            className="p-1.5 bg-slate-100 hover:bg-[#5750f1] hover:text-white text-slate-700 rounded-lg text-xs transition-colors inline-flex items-center"
                          >
                            <ScanSearch className="w-3.5 h-3.5" />
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

      {/* Modal de revisión QC */}
      {reviewDevice && (
        <ReviewDeviceModal
          device={reviewDevice}
          onClose={() => setReviewDevice(null)}
          onSaved={() => {
            setReviewDevice(null);
            refreshBatch();
          }}
        />
      )}

      {/* Modal de asignación de IMEI a QC */}
      {assignDevice && (
        <AssignDeviceModal
          device={assignDevice}
          onClose={() => setAssignDevice(null)}
          onAssigned={() => {
            setAssignDevice(null);
            refreshBatch();
          }}
        />
      )}

      {/* Verificador Físico (pistola de IMEIs) */}
      {showVerifier && (
        <FisicoVerifierModal
          batchNumber={batch.batchNumber}
          devices={(batch.devices || []).map((dev: any) => ({
            id: dev.id,
            imei: dev.imei ?? null,
            serialNumber: dev.serialNumber ?? null,
            brand: dev.brand ?? null,
            model: dev.model,
            color: dev.color ?? null,
            storageGb: dev.storageGb ?? null,
            status: dev.status,
            result: dev.inspections?.[0]?.status === "COMPLETED" ? dev.inspections[0].result : null,
          }))}
          onClose={() => setShowVerifier(false)}
        />
      )}

      {/* No Funcionales — recuperación (marcar funcional) */}
      {showNoFuncionales && (
        <NoFuncionalesModal
          batchNumber={batch.batchNumber}
          devices={(batch.devices || []).map((dev: any) => ({
            id: dev.id,
            imei: dev.imei ?? null,
            serialNumber: dev.serialNumber ?? null,
            brand: dev.brand ?? null,
            model: dev.model,
            color: dev.color ?? null,
            storageGb: dev.storageGb ?? null,
            status: dev.status,
            result: dev.inspections?.[0]?.status === "COMPLETED" ? dev.inspections[0].result : null,
            grade: dev.inspections?.[0]?.grade ?? null,
            batteryHealth: dev.inspections?.[0]?.batteryHealth ?? null,
            functionalityNotes: dev.inspections?.[0]?.functionalityNotes ?? null,
            reviewedAt: dev.inspections?.[0]?.reviewedAt ?? null,
          }))}
          onClose={() => setShowNoFuncionales(false)}
          onChanged={() => refreshBatch()}
        />
      )}

      {/* Agregar Equipos a la compra */}
      {showAddDevices && (
        <AddDevicesModal
          batchId={batch.id}
          batchNumber={batch.batchNumber}
          existingModels={[]}
          onClose={() => setShowAddDevices(false)}
          onChanged={() => refreshBatch()}
        />
      )}
    </div>
  );
}
