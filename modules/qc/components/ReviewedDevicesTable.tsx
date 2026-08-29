"use client";

import { useEffect, useRef, useState } from "react";
import {
  BatteryMedium,
  CheckCircle2,
  ClipboardCheck,
  CircleHelp,
  ShieldAlert,
  X,
  User,
  Calendar,
  Package,
  StickyNote,
  Camera,
  History,
  Pencil,
  Loader2,
} from "lucide-react";
import { formatDateTimeRD } from "@/lib/utils/format";
import { getDeviceHistoryAction } from "../actions/device-history";
import { updateDeviceAction } from "../actions/device-edit";
import { useRouter } from "next/navigation";
import { cacheDevicePhotos, clearCachedDevicePhotos, getCachedDevicePhotos } from "../lib/photo-cache";

export type ReviewedInspection = {
  id: string;
  result: "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | null;
  grade: string | null;
  batteryHealth: number | null;
  functionalityNotes: string | null;
  physicalNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  reviewerNameSnapshot: string;
  reviewerId: string | null;
  reviewer: { id: string; name: string | null; username: string | null } | null;
  device: {
    id: string;
    imei: string | null;
    serialNumber: string | null;
    brand: string | null;
    model: string;
    storageGb: number | null;
    color: string | null;
    status: string;
    batch: { batchNumber: string; supplierName: string; status: string } | null;
  };
};

const DEVICE_STATUS_LABEL: Record<string, string> = {
  PENDING_QC: "Pendiente de QC",
  IN_QC: "En QC",
  AVAILABLE: "Disponible",
  QUARANTINED: "En cuarentena",
  ARCHIVED: "Archivado",
};

function resultLabel(result: ReviewedInspection["result"]) {
  if (result === "FUNCTIONAL") return "Funcional";
  if (result === "NON_FUNCTIONAL") return "No funcional";
  return "Sin clasificación";
}

function resultTone(result: ReviewedInspection["result"]) {
  if (result === "FUNCTIONAL") return "border-[#abefc6] bg-[#ecfdf3] text-[#067647]";
  if (result === "NON_FUNCTIONAL") return "border-[#fecdca] bg-[#fef3f2] text-[#b42318]";
  return "border-[#fedf89] bg-[#fffaeb] text-[#b54708]";
}

function ResultIcon({ result }: { result: ReviewedInspection["result"] }) {
  if (result === "FUNCTIONAL") return <CheckCircle2 className="w-4 h-4" />;
  if (result === "NON_FUNCTIONAL") return <ShieldAlert className="w-4 h-4" />;
  return <CircleHelp className="w-4 h-4" />;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f4f7] text-[#667085]">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-[#344054]">{children}</div>
      </div>
    </div>
  );
}

type HistoryInspection = {
  id: string;
  result: "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | null;
  grade: string | null;
  batteryHealth: number | null;
  functionalityNotes: string | null;
  physicalNotes: string | null;
  reviewerNameSnapshot: string;
  reviewedAt: Date | null;
  createdAt: Date;
  status: "DRAFT" | "COMPLETED" | "SUPERSEDED";
};

type DeviceHistory = {
  inspections: HistoryInspection[];
  photos: { id: string; url: string }[];
};

export function ReviewedDevicesTable({ inspections }: { inspections: ReviewedInspection[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReviewedInspection | null>(null);
  const [history, setHistory] = useState<DeviceHistory | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const photoRefreshAttempted = useRef(false);

  // Edición del equipo (admin)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ brand: "", model: "", storageGb: "", color: "", result: "UNSPECIFIED" as "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" });
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      brand: selected.device.brand ?? "",
      model: selected.device.model ?? "",
      storageGb: selected.device.storageGb ? String(selected.device.storageGb) : "",
      color: selected.device.color ?? "",
      result: selected.result ?? "UNSPECIFIED",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!editForm.model.trim()) return showToast("error", "El modelo es obligatorio.");
    const storageGb = editForm.storageGb.trim() ? Number(editForm.storageGb) : null;
    if (editForm.storageGb.trim() && (!Number.isInteger(storageGb) || (storageGb as number) < 1)) {
      return showToast("error", "Almacenamiento inválido.");
    }
    setSaving(true);
    const res = await updateDeviceAction({
      deviceId: selected.device.id,
      brand: editForm.brand.trim() || undefined,
      model: editForm.model.trim(),
      storageGb,
      color: editForm.color.trim() || undefined,
      result: editForm.result,
    });
    setSaving(false);
    if (res.success) {
      setSelected({
        ...selected,
        device: {
          ...selected.device,
          brand: editForm.brand.trim() || null,
          model: editForm.model.trim(),
          storageGb,
          color: editForm.color.trim() || null,
          status: editForm.result === "FUNCTIONAL" ? "AVAILABLE" : editForm.result === "NON_FUNCTIONAL" ? "QUARANTINED" : "PENDING_QC",
        },
        result: editForm.result,
      });
      setEditing(false);
      showToast("success", res.message ?? "Equipo actualizado.");
      router.refresh();
    } else {
      showToast("error", res.error || "No se pudo actualizar el equipo.");
    }
  };

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Cargar historial completo del equipo (fotos + todas las inspecciones)
  useEffect(() => {
    if (!selected) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    photoRefreshAttempted.current = false;
    setHistory(null);
    (async () => {
      const cachedPhotos = getCachedDevicePhotos(selected.device.id);
      const res = await getDeviceHistoryAction(selected.device.id);
      if (!cancelled && res.success && res.data) {
        const photos = cachedPhotos ?? res.data.photos;
        if (!cachedPhotos) cacheDevicePhotos(selected.device.id, photos);
        setHistory({ ...res.data, photos });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const refreshPhotosAfterError = async () => {
    if (!selected || photoRefreshAttempted.current) return;
    photoRefreshAttempted.current = true;
    clearCachedDevicePhotos(selected.device.id);
    const res = await getDeviceHistoryAction(selected.device.id);
    if (res.success && res.data) {
      cacheDevicePhotos(selected.device.id, res.data.photos);
      setHistory((current) => (current ? { ...current, photos: res.data.photos } : res.data));
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full text-left text-sm">
          <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
            <tr>
              <th className="px-6 py-3">IMEI / Serie</th>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Calidad</th>
              <th className="px-4 py-3">Revisado por</th>
              <th className="px-6 py-3 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaecf0]">
            {inspections.map((inspection) => (
              <tr
                key={inspection.id}
                onClick={() => setSelected(inspection)}
                title="Ver detalle de la revisión"
                className="cursor-pointer hover:bg-[#fcfcfd]"
              >
                <td className="px-6 py-4 font-mono text-xs font-semibold text-[#344054]">
                  {inspection.device.imei ?? inspection.device.serialNumber ?? "—"}
                </td>
                <td className="px-4 py-4 font-semibold text-[#475467]">{inspection.device.brand ?? "—"}</td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-[#101828]">{inspection.device.model}</p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {[inspection.device.storageGb ? `${inspection.device.storageGb} GB` : null, inspection.device.color]
                      .filter(Boolean)
                      .join(" · ") || "Sin detalles adicionales"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${resultTone(inspection.result)}`}>
                    {resultLabel(inspection.result)}
                  </span>
                </td>
                <td className="px-4 py-4 text-[#475467]">
                  <span className="font-semibold text-[#344054]">
                    {inspection.grade ? `Grado ${inspection.grade}` : "Sin grado"}
                  </span>
                  {inspection.batteryHealth !== null ? (
                    <span className="ml-2 text-xs">· {inspection.batteryHealth}% batería</span>
                  ) : null}
                </td>
                <td className="px-4 py-4 font-medium text-[#344054]">{inspection.reviewerNameSnapshot}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-[#667085]">
                  {inspection.reviewedAt ? formatDateTimeRD(inspection.reviewedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e4e7ec] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#eaecf0] flex items-center justify-between bg-[#fcfcfd]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <ClipboardCheck size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[#101828]">Detalle de la revisión</h2>
                  <p className="font-mono text-xs text-[#667085]">
                    {selected.device.imei ?? selected.device.serialNumber ?? "Sin identificador"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={openEdit}
                  className="flex items-center gap-1.5 p-1.5 text-xs font-bold text-slate-400 hover:text-[#4f46e5] rounded-lg hover:bg-[#eef2ff] transition-colors"
                  aria-label="Editar equipo"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Equipo */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-[#101828]">
                  {[selected.device.brand, selected.device.model].filter(Boolean).join(" ")}
                </p>
                {selected.device.storageGb ? (
                  <span className="rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-2.5 py-0.5 text-xs font-semibold text-[#475467]">
                    {selected.device.storageGb} GB
                  </span>
                ) : null}
                {selected.device.color ? (
                  <span className="rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-2.5 py-0.5 text-xs font-semibold text-[#475467]">
                    {selected.device.color}
                  </span>
                ) : null}
                <span className="rounded-full border border-[#e4e7ec] bg-[#fcfcfd] px-2.5 py-0.5 text-xs font-semibold text-[#667085]">
                  {DEVICE_STATUS_LABEL[selected.device.status] ?? selected.device.status}
                </span>
              </div>

              {/* Resultado */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${resultTone(selected.result)}`}>
                  <ResultIcon result={selected.result} />
                  {resultLabel(selected.result)}
                </span>
                <span className="text-sm font-semibold text-[#344054]">
                  {selected.grade ? `Grado ${selected.grade}` : "Sin grado"}
                </span>
                {selected.batteryHealth !== null ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#667085]">
                    <BatteryMedium className="w-3.5 h-3.5" /> {selected.batteryHealth}%
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow icon={User} label="Revisado por">
                  <span className="font-semibold text-[#101828]">{selected.reviewerNameSnapshot}</span>
                  {selected.reviewer?.username ? (
                    <span className="block text-xs text-[#667085]">@{selected.reviewer.username}</span>
                  ) : null}
                </DetailRow>
                <DetailRow icon={Calendar} label="Revisado el">
                  {selected.reviewedAt ? formatDateTimeRD(selected.reviewedAt) : "—"}
                </DetailRow>
                <DetailRow icon={Package} label="Lote de origen">
                  {selected.device.batch ? (
                    <>
                      <span className="font-semibold text-[#101828]">{selected.device.batch.batchNumber}</span>
                      {selected.device.batch.supplierName ? (
                        <span className="block text-xs text-[#667085]">{selected.device.batch.supplierName}</span>
                      ) : null}
                    </>
                  ) : (
                    "Sin lote"
                  )}
                </DetailRow>
                <DetailRow icon={Calendar} label="Registrado el">
                  {formatDateTimeRD(selected.createdAt)}
                </DetailRow>
              </div>

              {(selected.functionalityNotes || selected.physicalNotes) && (
                <div className="space-y-3">
                  {selected.functionalityNotes ? (
                    <div className="rounded-xl border border-[#e4e7ec] bg-[#fcfcfd] p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                        <StickyNote className="w-3.5 h-3.5" /> Notas de funcionalidad
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#344054]">{selected.functionalityNotes}</p>
                    </div>
                  ) : null}
                  {selected.physicalNotes ? (
                    <div className="rounded-xl border border-[#e4e7ec] bg-[#fcfcfd] p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                        <StickyNote className="w-3.5 h-3.5" /> Notas físicas
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#344054]">{selected.physicalNotes}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Fotos del equipo */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                  <Camera className="w-3.5 h-3.5" /> Fotos del equipo ({history?.photos.length ?? 0})
                </p>
                {history && history.photos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {history.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxUrl(photo.url)}
                        title="Ver foto"
                        className="aspect-square overflow-hidden rounded-xl border border-[#e4e7ec] bg-[#f9fafb] hover:border-[#4f46e5] transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt="Foto del equipo"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() => void refreshPhotosAfterError()}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#98a2b3]">Sin fotos registradas.</p>
                )}
              </div>

              {/* Historial de inspecciones */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                  <History className="w-3.5 h-3.5" /> Historial de inspecciones ({history?.inspections.length ?? 0})
                </p>
                {history && history.inspections.length > 0 ? (
                  <div className="space-y-2">
                    {history.inspections.map((insp) => (
                      <div
                        key={insp.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                          insp.id === selected.id
                            ? "border-[#4f46e5] bg-[#eef2ff]"
                            : "border-[#e4e7ec] bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#101828]">
                            {resultLabel(insp.result)}
                            {insp.grade ? ` · Grado ${insp.grade}` : ""}
                            {insp.batteryHealth !== null ? ` · ${insp.batteryHealth}% batería` : ""}
                          </p>
                          <p className="truncate text-[11px] text-[#667085]">
                            {insp.reviewerNameSnapshot}
                            {insp.reviewedAt ? ` · ${formatDateTimeRD(insp.reviewedAt)}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            insp.id === selected.id
                              ? "border-[#c7d2fe] bg-white text-[#4f46e5]"
                              : insp.status === "SUPERSEDED"
                              ? "border-[#e4e7ec] bg-[#fcfcfd] text-[#98a2b3]"
                              : "border-[#e4e7ec] bg-[#fcfcfd] text-[#667085]"
                          }`}
                        >
                          {insp.id === selected.id ? "Actual" : insp.status === "SUPERSEDED" ? "Reemplazada" : "Anterior"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#98a2b3]">Sin inspecciones registradas.</p>
                )}
              </div>
            </div>

            <div className="border-t border-[#eaecf0] bg-[#fcfcfd] px-6 py-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2.5 text-xs font-bold text-[#344054] hover:bg-[#f2f4f7] rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e4e7ec] w-full max-w-md flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#eaecf0] flex items-center justify-between bg-[#fcfcfd]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <Pencil size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[#101828]">Editar equipo</h2>
                  <p className="font-mono text-xs text-[#667085]">
                    {selected.device.imei ?? selected.device.serialNumber ?? "Sin identificador"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !saving && setEditing(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Marca</label>
                <input
                  type="text"
                  value={editForm.brand}
                  onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                  placeholder="Ej: Apple"
                  className="mt-1.5 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Modelo *</label>
                <input
                  type="text"
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                  placeholder="Ej: iPhone 13"
                  className="mt-1.5 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Almacenamiento (GB)</label>
                  <input
                    type="number"
                    value={editForm.storageGb}
                    onChange={(e) => setEditForm({ ...editForm, storageGb: e.target.value })}
                    placeholder="128"
                    min={1}
                    className="mt-1.5 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Color</label>
                  <input
                    type="text"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    placeholder="Ej: Negro"
                    className="mt-1.5 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">Resultado de revisión</label>
                <select
                  value={editForm.result}
                  onChange={(e) => setEditForm({ ...editForm, result: e.target.value as typeof editForm.result })}
                  className="mt-1.5 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/10"
                >
                  <option value="FUNCTIONAL">Funcional</option>
                  <option value="NON_FUNCTIONAL">No funcional</option>
                  <option value="UNSPECIFIED">Sin clasificación</option>
                </select>
              </div>
              <p className="text-xs text-[#98a2b3]">
                El IMEI no se edita aquí. Al cambiar el resultado, también se actualiza el estado operativo del equipo.
              </p>
            </div>

            <div className="border-t border-[#eaecf0] bg-[#fcfcfd] px-6 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-[#d0d5dd] bg-white text-xs font-bold text-[#344054] hover:bg-[#f2f4f7] transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold shadow-md shadow-[#4f46e5]/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Foto del equipo"
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white bg-slate-900/60 hover:bg-slate-900 rounded-full transition-colors"
            aria-label="Cerrar foto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[70] rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-bold text-white animate-in slide-in-from-bottom-4 duration-300 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
