"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createWarrantyCases,
  getWarrantyDocument,
  lookupImeiContext,
} from "@/modules/garantias/actions/warranty";
import {
  WarrantyDocumentPreviewModal,
  type WarrantyDocument,
} from "@/modules/garantias/components/WarrantyDocumentPreviewModal";
import { listBusinessPartnersAction } from "@/modules/configuracion/actions/business-partner";

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
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);

  // Modal para pegar lote de IMEIs
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Referencias a los inputs de IMEI para foco automático
  const imeiRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    void listBusinessPartnersAction("CUSTOMER").then((result) => {
      if (result.success)
        setCustomers(result.data.map((customer) => ({ id: customer.id, name: customer.name })));
    });
  }, []);

  async function handleImeiChange(index: number, val: string) {
    const cleanImei = val.replace(/\D/g, "").slice(0, 15);
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
            current.map((dev, i) =>
              i === index
                ? {
                    ...dev,
                    autoSource: undefined,
                    detectedClient: undefined,
                    clientMismatch: false,
                  }
                : dev
            )
          );
        }
      } catch (err) {
        console.error("Error al consultar contexto de IMEI:", err);
      } finally {
        setLookupLoading((prev) => ({ ...prev, [index]: false }));
      }
    } else {
      setDevices((current) =>
        current.map((dev, i) =>
          i === index
            ? {
                ...dev,
                autoSource: undefined,
                detectedClient: undefined,
                clientMismatch: false,
              }
            : dev
        )
      );
    }
  }

  // Manejo de tecla Enter en el IMEI para flujo continuo de escaneo
  function handleImeiKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const currentDev = devices[index];
      if (currentDev && currentDev.imei.length === 15) {
        if (index === devices.length - 1 && devices.length < 100) {
          // Agregar nueva fila y enfocarla
          setDevices((current) => [...current, emptyDevice()]);
          window.setTimeout(() => {
            imeiRefs.current[index + 1]?.focus();
          }, 50);
        } else if (index < devices.length - 1) {
          imeiRefs.current[index + 1]?.focus();
        }
      }
    }
  }

  // Copiar falla del primer equipo a todos los demás
  function copyFirstProblemToAll() {
    const firstProblem = devices[0]?.problem?.trim();
    if (!firstProblem) return;
    setDevices((current) =>
      current.map((dev) => ({
        ...dev,
        problem: dev.problem.trim() ? dev.problem : firstProblem,
      }))
    );
  }

  // Procesar pegado de múltiples IMEIs
  async function processBulkPaste() {
    if (!pasteText.trim()) return;
    setBulkLoading(true);

    // Extraer cadenas que parezcan IMEIs (14-16 dígitos)
    const matches = pasteText.match(/\b\d{15}\b/g) || [];
    const uniqueImeis = Array.from(new Set(matches)).slice(0, 100);

    if (uniqueImeis.length === 0) {
      setBulkLoading(false);
      alert("No se encontraron números IMEI válidos de 15 dígitos en el texto.");
      return;
    }

    const newDevices: Device[] = uniqueImeis.map((imei) => ({
      imei,
      model: "",
      problem: devices[0]?.problem || "",
    }));

    setDevices(newDevices);
    setPasteModalOpen(false);
    setPasteText("");
    setBulkLoading(false);

    // Consultar contexto para todos los IMEIs en paralelo
    let detectedFirstClient = "";
    for (let i = 0; i < newDevices.length; i++) {
      const imei = newDevices[i].imei;
      setLookupLoading((prev) => ({ ...prev, [i]: true }));
      try {
        const res = await lookupImeiContext(imei);
        if (res.success && res.data.found) {
          const { clientName: foundClient, model: foundModel, source } = res.data;
          if (!detectedFirstClient && foundClient) {
            detectedFirstClient = foundClient;
          }
          setDevices((current) =>
            current.map((dev, idx) =>
              idx === i
                ? {
                    ...dev,
                    model: foundModel || dev.model,
                    autoSource: source,
                    detectedClient: foundClient,
                  }
                : dev
            )
          );
        }
      } catch (err) {
        console.error("Error consultando IMEI en lote:", err);
      } finally {
        setLookupLoading((prev) => ({ ...prev, [i]: false }));
      }
    }

    if (!clientName.trim() && detectedFirstClient) {
      setClientName(detectedFirstClient);
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
                  list="warranty-customers"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
                />
                <datalist id="warranty-customers">
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
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
                list="warranty-customers"
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
              />
              <datalist id="warranty-customers">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name} />
                ))}
              </datalist>
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
          <div className="border-b border-slate-200 p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">
                Equipos a recibir{" "}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({devices.length}/100)
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Escribe o escanea el IMEI. Presiona Enter para saltar a la siguiente fila.
              </p>
            </div>

            {/* Acciones de lote */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                <ClipboardList size={14} className="text-[#5750f1]" /> Pegar lote de IMEIs
              </button>
              {devices.length > 1 && Boolean(devices[0]?.problem?.trim()) && (
                <button
                  type="button"
                  onClick={copyFirstProblemToAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  title="Copiar la falla del equipo 1 a los demás"
                >
                  <Copy size={14} className="text-amber-600" /> Copiar falla a todos
                </button>
              )}
              {devices.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDevices([emptyDevice()])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  <RotateCcw size={13} /> Reiniciar lista
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {devices.map((device, index) => (
              <div key={index} className="p-4 sm:p-6">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Equipo {String(index + 1).padStart(2, "0")}
                    </p>
                    {device.detectedClient && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <Sparkles size={11} /> Autodetectado (
                        {device.autoSource === "invoice" ? "Factura" : "Garantía anterior"})
                      </span>
                    )}
                  </div>
                  {devices.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDevices((current) =>
                          current.filter((_, deviceIndex) => deviceIndex !== index)
                        )
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
                        ref={(el) => {
                          imeiRefs.current[index] = el;
                        }}
                        required
                        minLength={15}
                        maxLength={15}
                        inputMode="numeric"
                        placeholder="15 dígitos"
                        value={device.imei}
                        onChange={(event) => handleImeiChange(index, event.target.value)}
                        onKeyDown={(event) => handleImeiKeyDown(index, event)}
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
                      Atención: El IMEI pertenece al cliente registrado{" "}
                      <strong>{device.detectedClient}</strong>, pero el lote actual indica{" "}
                      <strong>{clientName}</strong>.
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
              onClick={() => {
                setDevices((current) => [...current, emptyDevice()]);
                window.setTimeout(() => {
                  imeiRefs.current[devices.length]?.focus();
                }, 50);
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#5750f1]/20 bg-white px-3 text-sm font-semibold text-[#5750f1] hover:bg-[#5750f1]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={16} /> Agregar otro equipo
            </button>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/garantias"
            className="text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
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
                <CheckCircle2 size={18} /> Guardar {devices.length} equipo
                {devices.length === 1 ? "" : "s"}
              </>
            )}
          </button>
        </div>

        {message && (
          <p
            role="status"
            className="rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-4 text-sm text-[#5750f1]"
          >
            {message}
          </p>
        )}
      </form>

      {/* Modal para pegar lote de IMEIs */}
      {pasteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5750f1]">
                  Importación masiva
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-800">Pegar lista de IMEIs</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Pega una lista de números IMEI (de Excel, archivo o notas). Detectamos automáticamente los números válidos de 15 dígitos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`354892018392019\n356920184910293\n351029384756102`}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={bulkLoading || !pasteText.trim()}
                onClick={processBulkPaste}
                className="rounded-xl bg-[#5750f1] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#463ec5] disabled:opacity-50"
              >
                {bulkLoading ? "Procesando..." : "Importar y consultar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {document && (
        <WarrantyDocumentPreviewModal document={document} onClose={() => setDocument(null)} />
      )}
    </>
  );
}
