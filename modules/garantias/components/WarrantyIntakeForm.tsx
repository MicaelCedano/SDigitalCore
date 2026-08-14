"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { createWarrantyCases, getWarrantyDocument, lookupImeiContext } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentPreviewModal, type WarrantyDocument } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";

type Device = {
  imei: string;
  model: string;
  problem: string;
  autoSource?: string;
  detectedClient?: string;
  clientMismatch?: boolean;
};

const emptyDevice = (): Device => ({ imei: "", model: "", problem: "" });

export function WarrantyIntakeForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
  );
  const [devices, setDevices] = useState<Device[]>([emptyDevice()]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [document, setDocument] = useState<WarrantyDocument | null>(null);
  const [lookupLoading, setLookupLoading] = useState<Record<number, boolean>>({});

  async function handleImeiChange(index: number, val: string) {
    const cleanImei = val.replace(/\D/g, "");
    updateDevice(index, "imei", cleanImei);

    if (cleanImei.length === 15) {
      setLookupLoading((prev) => ({ ...prev, [index]: true }));
      try {
        const res = await lookupImeiContext(cleanImei);
        if (res.success && res.data.found) {
          const { clientName: foundClient, model: foundModel, source } = res.data;

          setDevices((current) =>
            current.map((dev, i) => {
              if (i !== index) return dev;

              const nextModel = dev.model.trim() ? dev.model : foundModel || dev.model;
              const isMismatch = Boolean(
                clientName.trim() &&
                foundClient &&
                clientName.trim().toLowerCase() !== foundClient.trim().toLowerCase()
              );

              return {
                ...dev,
                model: nextModel,
                autoSource: source,
                detectedClient: foundClient,
                clientMismatch: isMismatch,
              };
            })
          );

          if (!clientName.trim() && foundClient) {
            setClientName(foundClient);
          }
        } else {
          setDevices((current) =>
            current.map((dev, i) => (i === index ? { ...dev, autoSource: undefined, detectedClient: undefined, clientMismatch: false } : dev))
          );
        }
      } catch (err) {
        console.error("Error al consultar contexto de IMEI:", err);
      } finally {
        setLookupLoading((prev) => ({ ...prev, [index]: false }));
      }
    } else {
      setDevices((current) =>
        current.map((dev, i) => (i === index ? { ...dev, autoSource: undefined, detectedClient: undefined, clientMismatch: false } : dev))
      );
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await createWarrantyCases({ clientName, entryDate, devices });
    setBusy(false);
    setMessage(
      result.success
        ? `Ingreso creado: ${result.data.caseCodes.join(", ")}. Documento ${result.data.documentCode}.`
        : result.error
    );

    if (result.success) {
      window.dispatchEvent(new Event("warranty-data-changed"));
      router.refresh();
      const documentResult = await getWarrantyDocument(result.data.documentCode);
      if (documentResult.success) setDocument(documentResult.data as WarrantyDocument);
      setDevices([emptyDevice()]);
    }
  }

  function updateDevice(index: number, field: keyof Device, value: string | boolean) {
    setDevices((current) =>
      current.map((device, deviceIndex) =>
        deviceIndex === index ? { ...device, [field]: value } : device
      )
    );
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-6">
        {!embedded && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5750f1]">
                  Nuevo ingreso
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-800">Datos de recepción</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Estos datos se aplicarán a todos los equipos agregados.
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5750f1]/10 text-[#5750f1]">
                <CheckCircle2 size={19} />
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Cliente
                <input
                  required
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Nombre del cliente"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fecha de ingreso
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                />
              </label>
            </div>
          </section>
        )}

        {embedded && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Cliente
              <input
                required
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nombre del cliente"
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha de ingreso
              <input
                type="date"
                required
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              />
            </label>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold text-slate-800">
                Equipos a recibir{" "}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({devices.length}/100)
                </span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Al escribir un IMEI de 15 dígitos se autocompleta el cliente y modelo detectados.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {devices.map((device, index) => (
              <div key={index} className="p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Equipo {String(index + 1).padStart(2, "0")}
                    </p>
                    {device.detectedClient && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <Sparkles size={11} /> Autodetectado ({device.autoSource === "invoice" ? "Factura" : "Garantía anterior"})
                      </span>
                    )}
                  </div>
                  {devices.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDevices((current) => current.filter((_, deviceIndex) => deviceIndex !== index))
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                    >
                      <Trash2 size={14} /> Quitar
                    </button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[1.1fr_1.2fr_2fr]">
                  <label className="text-xs font-semibold text-slate-500">
                    IMEI
                    <div className="relative">
                      <input
                        required
                        minLength={15}
                        maxLength={15}
                        inputMode="numeric"
                        placeholder="15 dígitos"
                        value={device.imei}
                        onChange={(event) => handleImeiChange(index, event.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                      />
                      {lookupLoading[index] && (
                        <span className="absolute right-3 top-3.5 text-xs text-slate-400 animate-pulse">
                          Buscando...
                        </span>
                      )}
                    </div>
                  </label>

                  <label className="text-xs font-semibold text-slate-500">
                    Modelo
                    <input
                      required
                      maxLength={120}
                      placeholder="Marca y modelo"
                      value={device.model}
                      onChange={(event) => updateDevice(index, "model", event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                    />
                  </label>

                  <label className="text-xs font-semibold text-slate-500">
                    Falla reportada
                    <input
                      required
                      maxLength={1000}
                      placeholder="Describe el problema del equipo"
                      value={device.problem}
                      onChange={(event) => updateDevice(index, "problem", event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                    />
                  </label>
                </div>

                {device.clientMismatch && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                    <span>
                      Atención: El IMEI pertenece al cliente registrado <strong>{device.detectedClient}</strong>, pero el lote actual indica <strong>{clientName}</strong>.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
            <button
              type="button"
              disabled={devices.length >= 100}
              onClick={() => setDevices((current) => [...current, emptyDevice()])}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#5750f1]/20 bg-white px-3 text-sm font-semibold text-[#5750f1] hover:bg-[#5750f1]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={16} /> Agregar otro equipo
            </button>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/garantias" className="text-center text-sm font-medium text-slate-500 hover:text-slate-700">
            Cancelar
          </Link>
          <button
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-5 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition-all hover:bg-[#463ec5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              "Guardando..."
            ) : (
              <>
                <CheckCircle2 size={18} /> Guardar {devices.length} equipo{devices.length === 1 ? "" : "s"}
              </>
            )}
          </button>
        </div>

        {message && (
          <p role="status" className="rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-4 text-sm text-[#5750f1]">
            {message}
          </p>
        )}
      </form>

      {document && <WarrantyDocumentPreviewModal document={document} onClose={() => setDocument(null)} />}
    </>
  );
}
