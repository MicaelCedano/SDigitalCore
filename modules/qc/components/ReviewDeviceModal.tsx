"use client";

import { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  BatteryMedium,
  ClipboardCheck,
} from "lucide-react";
import { reviewDeviceAction } from "../actions/revision-batch";
import { ModelImageSearch } from "./ModelImageSearch";
import { DefectPhotosUploader } from "./DefectPhotosUploader";
import {
  getDevicePhotosAction,
  deleteDevicePhotoAction,
  uploadDevicePhotosAction,
} from "../actions/device-photos";
import { compressImage } from "@/lib/image-compression";
import { cacheDevicePhotos, getCachedDevicePhotos, clearCachedDevicePhotos } from "../lib/photo-cache";

const CHECKLIST_ITEMS = [
  { id: "pantalla", label: "Pantalla & Táctil" },
  { id: "bateria", label: "Batería / Carga" },
  { id: "camaras", label: "Cámaras (Fr./Post.)" },
  { id: "sensores", label: "Face ID / Touch ID" },
  { id: "audio", label: "Bocinas & Micrófono" },
  { id: "botones", label: "Botones Físicos" },
  { id: "conexion", label: "Wi-Fi & Bluetooth" },
  { id: "chasis", label: "Chasis / Estética Gral." },
];

const GRADES = [
  { value: "A", label: "A (Excelente)" },
  { value: "B", label: "B (Bueno)" },
  { value: "C", label: "C (Regular)" },
  { value: "D", label: "D (Malo)" },
  { value: "E", label: "E (Defectuoso)" },
];

const SUGGESTED_NOTES = [
  "Revisado OK",
  "Bocina superior no funciona",
  "Batería baja (<80%)",
  "Pantalla sin True Tone",
  "Detalles estéticos leves",
  "Puerto de carga flojo",
  "Face ID no funciona",
];

interface ReviewDeviceModalProps {
  device: any;
  onClose: () => void;
  onSaved: () => void;
}

export function ReviewDeviceModal({ device, onClose, onSaved }: ReviewDeviceModalProps) {
  const [funcionalidad, setFuncionalidad] = useState<"FUNCTIONAL" | "NON_FUNCTIONAL" | "">("");
  const [grado, setGrado] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [observacion, setObservacion] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; url: string }[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Cargar fotos existentes del equipo (historial de defectos)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = getCachedDevicePhotos(device.id);
      if (cached) {
        setExistingPhotos(cached);
        return;
      }
      const res = await getDevicePhotosAction(device.id);
      if (!cancelled && res.success) {
        const photos = (res.data ?? []).flatMap((p) => (p && p.url ? [{ id: p.id, url: p.url }] : []));
        setExistingPhotos(photos);
        cacheDevicePhotos(device.id, photos);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device.id]);

  // Sincronizar estado con el equipo al abrir (prefill solo si ya estaba revisado
  // EN ESTE lote — los reingresos con historial previo se revisan desde cero)
  useEffect(() => {
    const lastInspection = device.inspections?.[0];
    const batchStart = device.batch?.createdAt ? new Date(device.batch.createdAt).getTime() : 0;
    const isFromThisBatch =
      lastInspection && new Date(lastInspection.createdAt).getTime() >= batchStart;
    if (lastInspection && lastInspection.status === "COMPLETED" && isFromThisBatch) {
      setFuncionalidad(lastInspection.result === "FUNCTIONAL" ? "FUNCTIONAL" : "NON_FUNCTIONAL");
      setGrado(lastInspection.grade || "");
      setBatteryHealth(lastInspection.batteryHealth != null ? String(lastInspection.batteryHealth) : "");
      setObservacion(lastInspection.functionalityNotes || "");
    } else {
      // Reingreso o revisión nueva: formulario limpio
      setFuncionalidad("");
      setGrado("");
      setBatteryHealth("");
      setObservacion("");
    }
    const key = `sdigitalcore.qc.checklist.${device.id}`;
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (saved) {
      try {
        setChecklist(JSON.parse(saved));
      } catch {
        setChecklist({});
      }
    } else {
      setChecklist({});
    }
  }, [device]);

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklist((prev) => {
      const updated = { ...prev, [itemId]: checked };
      try {
        window.localStorage.setItem(
          `sdigitalcore.qc.checklist.${device.id}`,
          JSON.stringify(updated)
        );
      } catch {
        // sin persistencia si localStorage no está disponible
      }
      return updated;
    });
  };

  const checklistComplete = CHECKLIST_ITEMS.every((item) => checklist[item.id] === true);

  const submit = async () => {
    setError(null);

    // El resultado lo define el QC en Funcionalidad: sea bueno o malo, se
    // guarda tal cual (FUNCTIONAL o NON_FUNCTIONAL). Un solo botón.
    if (!funcionalidad) {
      setError("Selecciona si el equipo está Funcional o No Funcional.");
      return;
    }
    if (!grado) {
      setError("Completa el grado estético antes de guardar la revisión.");
      return;
    }
    if (funcionalidad === "FUNCTIONAL" && !checklistComplete) {
      setError("Debes completar todos los puntos del checklist para aprobar el equipo como funcional.");
      return;
    }

    setIsLoading(true);

    // Subir fotos nuevas (comprimidas en WebP) antes de guardar la revisión
    if (selectedFiles.length > 0) {
      const formData = new FormData();
      formData.set("deviceId", device.id);
      for (const file of selectedFiles) {
        try {
          const blob = await compressImage(file);
          formData.append("files", blob, file.name.replace(/\.[^.]+$/, "") + ".webp");
        } catch (e: any) {
          setError(e.message || "Error al procesar una de las fotos.");
          setIsLoading(false);
          return;
        }
      }
      const up = await uploadDevicePhotosAction(formData);
      if (!up.success) {
        setError(up.error || "No se pudieron subir las fotos.");
        setIsLoading(false);
        return;
      }
      // La caché anterior ya no contiene las fotos recién guardadas.
      clearCachedDevicePhotos(device.id);
    }

    const res = await reviewDeviceAction({
      deviceId: device.id,
      result: funcionalidad,
      grade: grado,
      notes: observacion.trim() || null,
      batteryHealth: batteryHealth ? Number(batteryHealth) : undefined,
    });
    setIsLoading(false);

    if (res.success) {
      onSaved();
    } else {
      setError(res.error || "Error al registrar la revisión del equipo.");
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setError(null);
    const res = await deleteDevicePhotoAction(photoId);
    if (res.success) {
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
      clearCachedDevicePhotos(device.id);
    } else {
      setError(res.error || "No se pudo eliminar la foto.");
    }
  };

  const checkedCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Revisar Equipo</h2>
              <p className="text-xs text-slate-500">
                {device.brand} {device.model}
                {device.storageGb ? ` · ${device.storageGb}GB` : ""}
                {device.color ? ` · ${device.color}` : ""}
              </p>
              <p className="text-[11px] font-mono font-bold text-slate-400 mt-0.5">
                IMEI {device.imei || device.serialNumber || "—"}
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Imagen de referencia del modelo (búsqueda en internet, como System) */}
          <ModelImageSearch brand={device.brand} model={device.model} color={device.color} />

          {/* Grado y Funcionalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Grado Estético <span className="text-red-500">*</span>
              </label>
              <select
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              >
                <option value="">Seleccionar...</option>
                {GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Funcionalidad <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFuncionalidad("FUNCTIONAL")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    funcionalidad === "FUNCTIONAL"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Funcional
                </button>
                <button
                  type="button"
                  onClick={() => setFuncionalidad("NON_FUNCTIONAL")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    funcionalidad === "NON_FUNCTIONAL"
                      ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-red-50 hover:border-red-300"
                  }`}
                >
                  <XCircle className="w-4 h-4" /> No Funcional
                </button>
              </div>
            </div>
          </div>

          {/* Batería */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <BatteryMedium className="w-4 h-4 text-slate-400" /> Salud de Batería (%) — opcional
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={batteryHealth}
              onChange={(e) => setBatteryHealth(e.target.value)}
              placeholder="Ej: 88"
              className="w-full sm:w-40 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones</label>
            <textarea
              rows={3}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Describe el problema o detalle encontrado..."
              className="w-full resize-none bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
            />
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {SUGGESTED_NOTES.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    const trimmed = observacion.trim();
                    if (!trimmed) {
                      setObservacion(sug);
                    } else if (!trimmed.toLowerCase().includes(sug.toLowerCase())) {
                      setObservacion(trimmed + ", " + sug);
                    }
                  }}
                  className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full hover:bg-[#5750f1]/10 hover:text-[#5750f1] hover:border-[#5750f1]/20 transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Fotos de defectos */}
          <div>
            <DefectPhotosUploader
              selectedFiles={selectedFiles}
              onFilesChange={setSelectedFiles}
              existingPhotos={existingPhotos}
              onDeleteExistingPhoto={handleDeletePhoto}
              isUploading={isLoading}
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Checklist de Revisión</label>
              <span className={`text-[11px] font-black ${checkedCount === CHECKLIST_ITEMS.length ? "text-emerald-600" : "text-slate-500"}`}>
                {checkedCount} / {CHECKLIST_ITEMS.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-[#5750f1]/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checklist[item.id] || false}
                      onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                      className="rounded border-slate-300 w-4 h-4 cursor-pointer accent-[#5750f1]"
                    />
                    <span className="text-[11px] font-bold text-slate-700 select-none leading-none">
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider ${
                      checklist[item.id] ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {checklist[item.id] ? "Completado" : "Pendiente"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isLoading || !funcionalidad}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={funcionalidad ? `Guardar como ${funcionalidad === "FUNCTIONAL" ? "Funcional" : "No Funcional"}` : "Selecciona Funcionalidad primero"}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : funcionalidad === "NON_FUNCTIONAL" ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isLoading
              ? "Guardando..."
              : funcionalidad === "NON_FUNCTIONAL"
              ? "Guardar como No Funcional"
              : "Guardar Revisión"}
          </button>
        </div>
      </div>
    </div>
  );
}
