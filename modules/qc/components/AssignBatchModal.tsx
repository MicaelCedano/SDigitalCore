"use client";

import { useState, useEffect } from "react";
import { X, UserCheck, Loader2, AlertCircle, UserX } from "lucide-react";
import {
  assignRevisionBatchAction,
  getQcAssigneesAction,
} from "../actions/revision-batch";

interface AssignBatchModalProps {
  batch: any;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignBatchModal({ batch, onClose, onAssigned }: AssignBatchModalProps) {
  const [assignees, setAssignees] = useState<
    { id: string; name: string | null; username: string | null; email: string | null }[]
  >([]);
  const [selected, setSelected] = useState<string>(batch.assignedToId || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQcAssigneesAction().then((res) => {
      if (res.success && res.data) setAssignees(res.data);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await assignRevisionBatchAction({
      id: batch.id,
      assignedToId: selected || null,
    });
    setSaving(false);
    if (res.success) {
      onAssigned();
    } else {
      setError(res.error || "No se pudo asignar el lote.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Asignar Lote a QC</h2>
              <p className="text-xs text-slate-500">
                <span className="font-mono font-bold text-[#5750f1]">{batch.batchNumber}</span>
                {" · "}
                {batch.supplierName}
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

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Revisor asignado (Control de Calidad)
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando usuarios QC...
              </div>
            ) : (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5750f1]"
              >
                <option value="">— Sin asignar —</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.username || u.email}
                  </option>
                ))}
              </select>
            )}
            {!loading && assignees.length === 0 && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1.5">
                No hay usuarios con el módulo QC activo para asignar.
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            El usuario asignado verá este lote en su lista y podrá revisar sus equipos.
            El administrador puede revisar cualquier lote.
          </p>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="px-4 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selected ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
            {selected ? "Asignar Lote" : "Quitar Asignación"}
          </button>
        </div>
      </div>
    </div>
  );
}
