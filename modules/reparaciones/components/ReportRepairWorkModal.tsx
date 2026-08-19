"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2, X, Wrench, Smartphone, User, XCircle, Zap } from "lucide-react";

export interface ReportItemInput {
  imei: string;
  marca?: string;
  modelo?: string;
  problema: string;
  cliente: string;
  resultado: "REPAIRED" | "UNREPAIRED";
  warrantyCaseId?: string;
}

const emptyItem = (): ReportItemInput => ({ imei: "", marca: "", modelo: "", problema: "", cliente: "", resultado: "REPAIRED" });

export function ReportRepairWorkModal({
  prefilled,
  onClose,
  onSubmit,
}: {
  prefilled?: ReportItemInput | null;
  onClose: () => void;
  onSubmit: (values: { observaciones?: string; items: ReportItemInput[] }) => Promise<boolean>;
}) {
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ReportItemInput[]>(prefilled ? [prefilled] : [emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateItem(index: number, field: keyof ReportItemInput, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function appendItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  async function handleSubmit() {
    setError("");
    const cleaned = items.map((item) => ({
      ...item,
      imei: item.imei.trim(),
      marca: item.marca?.trim() || undefined,
      modelo: item.modelo?.trim() || undefined,
      problema: item.problema.trim(),
      cliente: item.cliente.trim(),
      warrantyCaseId: item.warrantyCaseId || undefined,
    }));

    if (cleaned.length === 0) return setError("Debe agregar al menos un equipo.");
    const invalid = cleaned.find((item) => item.imei.length < 5 || item.problema.length < 3 || item.cliente.length < 2);
    if (invalid) return setError("Completa IMEI, problema y cliente en todos los equipos.");

    setBusy(true);
    const ok = await onSubmit({ observaciones: observaciones.trim() || undefined, items: cleaned });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#5750f1]/20 bg-[#5750f1]/10 text-[#5750f1]">
              <Wrench size={23} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
                Reportar trabajo realizado
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Equipos reparados listos para cobro · queda pendiente de aprobación del administrador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X size={21} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {/* Notas */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Notas del reporte
            </label>
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              placeholder="Notas generales para el administrador (opcional)..."
              maxLength={1000}
              className="mt-2 min-h-16 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Resultado por equipo
              </h3>
              <button
                type="button"
                onClick={appendItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#5750f1]/30 px-3 py-2 text-[11px] font-bold text-[#5750f1] transition hover:bg-[#5750f1]/10"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir otro
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">IMEI / Serial</span>
                    <div className="relative mt-1.5">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <input
                        value={item.imei}
                        onChange={(event) => updateItem(index, "imei", event.target.value)}
                        placeholder="IMEI"
                        disabled={Boolean(item.warrantyCaseId)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm font-mono outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Cliente</span>
                    <input
                      value={item.cliente}
                      onChange={(event) => updateItem(index, "cliente", event.target.value)}
                      placeholder="A quién pertenece?"
                      disabled={Boolean(item.warrantyCaseId)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Modelo / Marca</span>
                    <input
                      value={item.modelo ?? ""}
                      onChange={(event) => updateItem(index, "modelo", event.target.value)}
                      placeholder="Ej: iPhone 13"
                      disabled={Boolean(item.warrantyCaseId)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Problema original</span>
                    <input
                      value={item.problema}
                      onChange={(event) => updateItem(index, "problema", event.target.value)}
                      placeholder="Falla inicial"
                      disabled={Boolean(item.warrantyCaseId)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">¿Se pudo reparar?</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateItem(index, "resultado", "REPAIRED")}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                        item.resultado === "REPAIRED"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100"
                          : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Sí, reparado
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItem(index, "resultado", "UNREPAIRED")}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                        item.resultado === "UNREPAIRED"
                          ? "border-rose-300 bg-rose-50 text-rose-700 ring-2 ring-rose-100"
                          : "border-slate-200 bg-white text-slate-500 hover:border-rose-200"
                      }`}
                    >
                      <XCircle className="h-4 w-4" /> No se pudo reparar
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {item.warrantyCaseId ? (
                    <span className="text-[10px] font-bold text-[#5750f1]">
                      Desde la cola de garantías — se marcará como recibido del técnico
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Reporte directo (IMEI suelto)</span>
                  )}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-[11px] text-slate-500">
            Al reportar, el trabajo queda <strong>pendiente de pago</strong> hasta que el administrador lo apruebe.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench size={16} />}
            {busy ? "Reportando..." : "Reportar y solicitar pago"}
          </button>
        </footer>
      </section>
    </div>
  );
}
