"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { updatePurchaseDeviceAction } from "../actions/device-edit";
import { normalizeModelName } from "../lib/model-name";

export function PurchaseDeviceEditModal({
  batchId,
  device,
  onClose,
  onSaved,
}: {
  batchId: string;
  device: any;
  onClose: () => void;
  onSaved: (data: { brand: string | null; model: string; storageGb: number | null; color: string | null }) => void;
}) {
  const [brand, setBrand] = useState(device.brand ?? "");
  const [model, setModel] = useState(device.model ?? "");
  const [storageGb, setStorageGb] = useState(device.storageGb ? String(device.storageGb) : "");
  const [color, setColor] = useState(device.color ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!model.trim()) return setError("El modelo es obligatorio.");
    const storage = storageGb.trim() ? Number(storageGb) : null;
    if (storageGb.trim() && (!Number.isInteger(storage) || (storage as number) < 1)) {
      return setError("La capacidad debe ser un número entero positivo.");
    }

    setSaving(true);
    setError("");
    const cleanBrand = brand.trim() || null;
    const cleanModel = normalizeModelName(model.trim(), cleanBrand);
    const res = await updatePurchaseDeviceAction({
      batchId,
      deviceId: device.id,
      brand: cleanBrand,
      model: cleanModel,
      storageGb: storage,
      color: color.trim() || null,
    });
    setSaving(false);
    if (!res.success) return setError(res.error);

    onSaved({
      brand: cleanBrand,
      model: cleanModel,
      storageGb: storage,
      color: color.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-device-edit-title">
      <form onSubmit={save} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="purchase-device-edit-title" className="text-lg font-black text-slate-900">Editar equipo de compra</h2>
            <p className="mt-1 text-xs text-slate-500">El IMEI, el estado QC y el historial no se modifican.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Marca<input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-bold text-slate-700">Modelo<input required value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-bold text-slate-700">Capacidad (GB)<input inputMode="numeric" value={storageGb} onChange={(e) => setStorageGb(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-bold text-slate-700">Color<input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></label>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </form>
    </div>
  );
}
