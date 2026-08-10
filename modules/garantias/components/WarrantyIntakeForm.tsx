"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { createWarrantyCases, getWarrantyDocument } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentPreviewModal, type WarrantyDocument } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";

type Device = { imei: string; model: string; problem: string };
const emptyDevice = (): Device => ({ imei: "", model: "", problem: "" });

export function WarrantyIntakeForm() {
  const [clientName, setClientName] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" }));
  const [devices, setDevices] = useState<Device[]>([emptyDevice()]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [document, setDocument] = useState<WarrantyDocument | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = await createWarrantyCases({ clientName, entryDate, devices });
    setBusy(false); setMessage(result.success ? `Ingreso creado: ${result.data.caseCodes.join(", ")}. Documento ${result.data.documentCode}.` : result.error);
    if (result.success) {
      const documentResult = await getWarrantyDocument(result.data.documentCode);
      if (documentResult.success) setDocument(documentResult.data as WarrantyDocument);
    }
    if (result.success) setDevices([emptyDevice()]);
  }
  function updateDevice(index: number, field: keyof Device, value: string) { setDevices((current) => current.map((device, deviceIndex) => deviceIndex === index ? { ...device, [field]: value } : device)); }

  return <><form onSubmit={submit} className="space-y-5">
    <section className="enterprise-panel p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Nuevo ingreso</p><h2 className="mt-1 text-lg font-semibold text-[#101828]">Datos de recepción</h2><p className="mt-1 text-sm text-[#667085]">Estos datos se aplicarán a todos los equipos agregados.</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CheckCircle2 size={19} /></span></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-[#344054]">Cliente<input required value={clientName} onChange={(event) => setClientName(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[#d0d5dd] px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></label><label className="text-sm font-medium text-[#344054]">Fecha de ingreso<input type="date" required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[#d0d5dd] px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></label></div></section>
    <section className="enterprise-panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#e4e7ec] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-semibold text-[#101828]">Equipos a recibir <span className="ml-1 text-xs font-normal text-[#98a2b3]">({devices.length})</span></h2><p className="mt-1 text-sm text-[#667085]">Cada IMEI genera un caso independiente y queda en estado Recibido.</p></div><button type="button" onClick={() => setDevices((current) => [...current, emptyDevice()])} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"><Plus size={16} /> Agregar equipo</button></div><div className="divide-y divide-[#f0f1f3]">{devices.map((device, index) => <div key={index} className="p-5 sm:p-6"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Equipo {String(index + 1).padStart(2, "0")}</p>{devices.length > 1 && <button type="button" onClick={() => setDevices((current) => current.filter((_, deviceIndex) => deviceIndex !== index))} className="inline-flex items-center gap-1 text-xs font-medium text-[#b42318] hover:underline"><Trash2 size={14} /> Quitar</button>}</div><div className="grid gap-3 md:grid-cols-[1.1fr_1.2fr_2fr]"><label className="text-xs font-semibold text-[#667085]">IMEI<input required maxLength={15} inputMode="numeric" placeholder="15 dígitos" value={device.imei} onChange={(event) => updateDevice(index, "imei", event.target.value.replace(/\D/g, ""))} className="mt-1 h-11 w-full rounded-lg border border-[#d0d5dd] px-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></label><label className="text-xs font-semibold text-[#667085]">Modelo<input required placeholder="Marca y modelo" value={device.model} onChange={(event) => updateDevice(index, "model", event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[#d0d5dd] px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></label><label className="text-xs font-semibold text-[#667085]">Falla reportada<input required placeholder="Describe el problema del equipo" value={device.problem} onChange={(event) => updateDevice(index, "problem", event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[#d0d5dd] px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" /></label></div></div>)}</div></section>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Link href="/garantias" className="text-center text-sm font-medium text-[#667085] hover:text-[#344054]">Cancelar</Link><button disabled={busy} className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Guardando..." : `Guardar ${devices.length} equipo${devices.length === 1 ? "" : "s"}`}</button></div>
    {message && <p role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">{message}</p>}
  </form>{document && <WarrantyDocumentPreviewModal document={document} onClose={() => setDocument(null)} />}</>;
}
