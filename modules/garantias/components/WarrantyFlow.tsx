"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { assignCasesToTechnician, deliverCasesToCustomer, getWarrantyDocument, markWarrantyCreditNote, receiveCasesFromSupplier, receiveCasesFromTechnician, sendCasesToSupplier } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentPreviewModal } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";

export type WarrantyFlowCase = { id: string; caseCode: string; imei: string; model: string; clientName: string; status: string };
export type WarrantyFlowOperation = "assign" | "receiveTech" | "sendSupplier" | "receiveSupplier" | "deliver" | "credit";
type Document = { documentCode: string; type: string; documentDate: string | Date; counterpartyName: string; notes?: string | null; items: Array<{ id: string; case: { caseCode: string; imei: string; model: string; clientName: string; problem: string } }> };

const config: Record<WarrantyFlowOperation, [string, string, string, string]> = {
  assign: ["Enviar equipos a técnico", "Técnico responsable", "Selecciona los equipos recibidos que pasarán a revisión.", "Generar entrega a técnico"],
  receiveTech: ["Recibir equipos del técnico", "Técnico que entrega", "Confirma qué equipos regresan del taller y en qué condición.", "Registrar recepción"],
  sendSupplier: ["Enviar a suplidor / marca", "Suplidor o marca", "Agrupa equipos elegibles y genera el documento de despacho.", "Generar despacho"],
  receiveSupplier: ["Recibir del suplidor", "Suplidor o marca", "Registra el retorno de los equipos enviados.", "Registrar recepción"],
  deliver: ["Despachar garantía al cliente", "Cliente receptor", "Selecciona los equipos listos para devolver al cliente.", "Generar entrega"],
  credit: ["Crear nota de crédito", "", "Selecciona los casos que se cerrarán mediante nota de crédito.", "Crear nota de crédito"],
};

export function WarrantyFlow({ operation, cases }: { operation: WarrantyFlowOperation; cases: WarrantyFlowCase[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [counterparty, setCounterparty] = useState("");
  const [reason, setReason] = useState("");
  const [repaired, setRepaired] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [title, label, hint, actionLabel] = config[operation];
  const needsReason = operation === "credit" || (operation === "receiveTech" && !repaired);
  const visibleCases = useMemo(() => cases.filter((item) => `${item.caseCode} ${item.clientName} ${item.model} ${item.imei}`.toLowerCase().includes(search.toLowerCase())), [cases, search]);
  const allVisibleSelected = visibleCases.length > 0 && visibleCases.every((item) => selected.includes(item.caseCode));

  useEffect(() => {
    if (!confirmOpen && !document) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && (document ? setDocument(null) : setConfirmOpen(false));
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, document]);

  function validateBeforeConfirm() {
    if (selected.length === 0) return setMessage("Selecciona al menos un equipo.");
    if (operation !== "credit" && !counterparty.trim()) return setMessage(`Indica el ${label.toLowerCase()}.`);
    if (needsReason && !reason.trim()) return setMessage("El motivo es obligatorio.");
    setMessage("");
    setConfirmOpen(true);
  }

  async function submit() {
    setConfirmOpen(false); setBusy(true); setMessage("");
    const input = { caseCodes: selected, counterpartyName: counterparty, reason };
    const result = operation === "assign" ? await assignCasesToTechnician(input) : operation === "receiveTech" ? await receiveCasesFromTechnician(input, repaired) : operation === "sendSupplier" ? await sendCasesToSupplier(input) : operation === "receiveSupplier" ? await receiveCasesFromSupplier(input) : operation === "deliver" ? await deliverCasesToCustomer(input) : await markWarrantyCreditNote(input);
    setBusy(false);
    if (!result.success) return setMessage(result.error);
    setSelected([]);
    const documentCode = (result.data as { documentCode?: string }).documentCode;
    if (!documentCode) return setMessage("Operación completada.");
    setLoadingDocument(true);
    const documentResult = await getWarrantyDocument(documentCode);
    setLoadingDocument(false);
    if (documentResult.success) setDocument(documentResult.data as Document);
    else setMessage(`Operación completada. Documento ${documentCode}.`);
  }

  function toggleAll() { setSelected(allVisibleSelected ? selected.filter((code) => !visibleCases.some((item) => item.caseCode === code)) : [...new Set([...selected, ...visibleCases.map((item) => item.caseCode)])]); }

  return <>
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-[#e4e7ec] bg-gradient-to-r from-white to-red-50/40 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Flujo de garantías</p><h1 className="mt-2 text-2xl font-black tracking-tight text-[#101828]">{title}</h1><p className="mt-2 max-w-2xl text-sm text-[#667085]">{hint} La confirmación y el documento se muestran en una ventana de revisión.</p></div><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600"><ShieldCheck size={23} /></span></div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#667085]"><span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#e4e7ec]">{selected.length} seleccionado(s)</span><span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">Documento con identidad roja</span></div>
      </div>
      {operation !== "credit" && <div className="grid gap-4 border-b border-[#e4e7ec] p-5 sm:grid-cols-2 sm:p-6"><label className="text-sm font-semibold text-[#344054]">{label}<input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder={operation === "assign" ? "Ej. Sahul" : "Nombre o empresa"} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label>{operation === "receiveTech" && <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium text-[#344054]"><input type="checkbox" checked={repaired} onChange={(event) => setRepaired(event.target.checked)} className="h-4 w-4 accent-red-600" /> Equipo reparado</label>}</div>}
      {needsReason && <div className="border-b border-[#e4e7ec] p-5 sm:p-6"><label className="text-sm font-semibold text-[#344054]">Motivo<textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe brevemente el motivo" className="mt-2 min-h-20 w-full rounded-xl border border-[#d0d5dd] p-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></label></div>}
      <div className="border-b border-[#e4e7ec] bg-[#fcfcfd] p-4 sm:p-5"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-[#98a2b3]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por caso, cliente, modelo o IMEI" className="h-11 w-full rounded-xl border border-[#d0d5dd] bg-white pl-9 pr-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10" /></div><div className="mt-3 flex items-center justify-between text-xs text-[#667085]"><span>{visibleCases.length} equipos elegibles</span><button type="button" onClick={toggleAll} className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline"><CheckSquare size={14} /> {allVisibleSelected ? "Quitar selección" : "Seleccionar visibles"}</button></div></div>
      <div className="max-h-[520px] divide-y divide-[#f0f1f3] overflow-y-auto">{visibleCases.map((item) => <label key={item.id} className={`flex cursor-pointer items-center gap-3 p-4 transition hover:bg-red-50/40 ${selected.includes(item.caseCode) ? "bg-red-50/60" : ""}`}><input type="checkbox" checked={selected.includes(item.caseCode)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.caseCode] : selected.filter((code) => code !== item.caseCode))} className="h-4 w-4 rounded border-[#d0d5dd] accent-red-600" /><span className="min-w-0 flex-1"><span className="font-mono text-xs font-bold text-red-600">{item.caseCode}</span><span className="ml-2 text-sm font-semibold text-[#344054]">{item.clientName} · {item.model}</span><span className="mt-1 block font-mono text-xs text-[#667085]">IMEI {item.imei}</span></span><UserRound size={17} className="text-[#98a2b3]" /></label>)}{visibleCases.length === 0 && <p className="p-10 text-center text-sm text-[#667085]">No hay casos elegibles para este flujo.</p>}</div>
      <div className="flex flex-col gap-3 border-t border-[#e4e7ec] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><span className="text-xs text-[#667085]">Puedes revisar los datos antes de confirmar.</span><button type="button" disabled={busy || loadingDocument || selected.length === 0} onClick={validateBeforeConfirm} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Procesando..." : loadingDocument ? "Abriendo documento..." : actionLabel}</button></div>
      {message && <p role="status" className="m-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">{message}</p>}
    </section>
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">Revisión antes de confirmar</p><h2 className="mt-2 text-xl font-black text-[#101828]">¿Confirmar {title.toLowerCase()}?</h2></div><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7]" aria-label="Cerrar"><X size={19} /></button></div><div className="mt-5 rounded-xl border border-red-100 bg-red-50/60 p-4 text-sm text-[#344054]"><p><strong>{selected.length}</strong> equipo(s) seleccionado(s)</p>{operation !== "credit" && <p className="mt-1">{label}: <strong>{counterparty}</strong></p>}{needsReason && <p className="mt-1">Motivo: <strong>{reason}</strong></p>}</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-semibold text-[#344054]">Volver</button><button type="button" onClick={submit} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">Confirmar y generar documento</button></div></div></div>}
    {document && <WarrantyDocumentPreviewModal document={document} onClose={() => setDocument(null)} />}
  </>;
}
