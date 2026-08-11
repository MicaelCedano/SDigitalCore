"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { assignCasesToTechnician, deliverCasesToCustomer, getWarrantyDocument, markWarrantyCreditNote, receiveCasesFromSupplier, receiveCasesFromTechnician, sendCasesToSupplier } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentPreviewModal } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";

export type WarrantyFlowCase = { id: string; caseCode: string; imei: string; model: string; clientName: string; status: string; assignedTechnicianName?: string | null; currentSupplierName?: string | null };
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

export function WarrantyFlow({ operation, cases, embedded = false }: { operation: WarrantyFlowOperation; cases: WarrantyFlowCase[]; embedded?: boolean }) {
  const router = useRouter();
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
  const needsReason = operation === "receiveTech" || operation === "receiveSupplier" || operation === "deliver" || operation === "credit";
  const reasonLabel = operation === "deliver" || operation === "credit" ? "Resolución del caso" : "Resultado / observación";
  const visibleCases = useMemo(() => cases.filter((item) => `${item.caseCode} ${item.clientName} ${item.model} ${item.imei}`.toLowerCase().includes(search.toLowerCase())), [cases, search]);
  const allVisibleSelected = visibleCases.length > 0 && visibleCases.every((item) => selected.includes(item.caseCode));

  useEffect(() => {
    if (!confirmOpen && !document) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && (document ? setDocument(null) : setConfirmOpen(false));
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, document]);

  // Auto-seleccionar y auto-llenar contraparte al escribir o escanear un IMEI o código de caso
  useEffect(() => {
    const query = search.trim();
    if (!query) return;

    const match = cases.find(
      (item) => item.imei === query || item.caseCode.toLowerCase() === query.toLowerCase()
    );

    if (match) {
      if (!selected.includes(match.caseCode)) {
        setSelected((prev) => [...prev, match.caseCode]);
      }
      const suggested =
        operation === "receiveTech"
          ? match.assignedTechnicianName
          : operation === "receiveSupplier"
          ? match.currentSupplierName
          : operation === "deliver"
          ? match.clientName
          : null;

      if (suggested && !counterparty.trim()) {
        setCounterparty(suggested);
      }
    }
  }, [search, cases, operation, counterparty, selected]);

  // Auto-llenar contraparte si todos los casos elegibles corresponden al mismo suplidor/técnico
  useEffect(() => {
    if (counterparty.trim()) return;
    const counterparties = cases
      .map((c) =>
        operation === "receiveTech"
          ? c.assignedTechnicianName
          : operation === "receiveSupplier"
          ? c.currentSupplierName
          : operation === "deliver"
          ? c.clientName
          : null
      )
      .filter(Boolean);

    if (counterparties.length > 0) {
      const first = counterparties[0];
      if (first && counterparties.every((item) => item === first)) {
        setCounterparty(first);
      }
    }
  }, [cases, operation, counterparty]);

  function validateBeforeConfirm() {
    if (selected.length === 0) return setMessage("Selecciona al menos un equipo.");
    if (operation !== "credit" && !counterparty.trim()) return setMessage(`Indica el ${label.toLowerCase()}.`);
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
    setReason("");
    window.dispatchEvent(new Event("warranty-data-changed"));
    router.refresh();
    const documentCode = (result.data as { documentCode?: string }).documentCode;
    if (!documentCode) return setMessage("Operación completada.");
    setLoadingDocument(true);
    const documentResult = await getWarrantyDocument(documentCode);
    setLoadingDocument(false);
    if (documentResult.success) setDocument(documentResult.data as Document);
    else setMessage(`Operación completada. Documento ${documentCode}.`);
  }

  function toggleAll() { setSelected(allVisibleSelected ? selected.filter((code) => !visibleCases.some((item) => item.caseCode === code)) : [...new Set([...selected, ...visibleCases.map((item) => item.caseCode)])]); }

  function selectCase(item: WarrantyFlowCase, checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, item.caseCode])] : current.filter((code) => code !== item.caseCode));
    if (!checked || counterparty.trim()) return;
    const suggested = operation === "receiveTech" ? item.assignedTechnicianName : operation === "receiveSupplier" ? item.currentSupplierName : operation === "deliver" ? item.clientName : null;
    if (suggested) setCounterparty(suggested);
  }

  return <>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {!embedded && <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5750f1]">Flujo de garantías</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-800">{title}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{hint} La confirmación y el documento se muestran en una ventana de revisión.</p></div><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5750f1]/10 text-[#5750f1]"><ShieldCheck size={23} /></span></div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-500"><span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{selected.length} seleccionado(s)</span><span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">Documento con identidad roja</span></div>
      </div>}
      {operation !== "credit" && <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 sm:p-6"><label className="text-sm font-semibold text-slate-700">{label}<input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder={operation === "assign" ? "Ej. Sahul" : "Nombre o empresa"} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label>{operation === "receiveTech" && <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={repaired} onChange={(event) => setRepaired(event.target.checked)} className="h-4 w-4 accent-[#5750f1]" /> Equipo reparado</label>}</div>}
      {needsReason && <div className="border-b border-slate-200 p-5 sm:p-6"><label className="text-sm font-semibold text-slate-700">{reasonLabel} <span className="text-xs font-normal text-slate-400">(Opcional)</span><textarea maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={operation === "deliver" ? "Indica cómo se resolvió y la conformidad de entrega (opcional)" : operation === "credit" ? "Explica por qué se cierra mediante nota de crédito (opcional)" : "Describe el trabajo realizado, resultado o condición de retorno (opcional)"} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></label><p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/1000</p></div>}
      <div className="border-b border-slate-200 bg-white p-4 sm:p-5"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar o escanear por IMEI, caso o cliente..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10" /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{visibleCases.length} equipos elegibles</span><button type="button" onClick={toggleAll} className="inline-flex items-center gap-1 font-bold text-[#5750f1] hover:underline"><CheckSquare size={14} /> {allVisibleSelected ? "Quitar selección" : "Seleccionar visibles"}</button></div></div>
      <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">{visibleCases.map((item) => <label key={item.id} className={`flex cursor-pointer items-center gap-3 p-4 transition hover:bg-[#5750f1]/5 ${selected.includes(item.caseCode) ? "bg-[#5750f1]/10" : ""}`}><input type="checkbox" checked={selected.includes(item.caseCode)} onChange={(event) => selectCase(item, event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#5750f1]" /><span className="min-w-0 flex-1"><span className="font-mono text-xs font-bold text-[#5750f1]">{item.caseCode}</span><span className="ml-2 text-sm font-semibold text-slate-700">{item.clientName} · {item.model}</span><span className="mt-1 block font-mono text-xs text-slate-500">IMEI {item.imei}</span>{operation === "receiveTech" && item.assignedTechnicianName && <span className="mt-1 block text-[11px] text-violet-600">Asignado a {item.assignedTechnicianName}</span>}{operation === "receiveSupplier" && item.currentSupplierName && <span className="mt-1 block text-[11px] text-orange-600">Enviado a {item.currentSupplierName}</span>}</span><UserRound size={17} className="text-slate-400" /></label>)}{visibleCases.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No hay casos elegibles para este flujo.</p>}</div>
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><span className="text-xs text-slate-500">Puedes revisar los datos antes de confirmar.</span><button type="button" disabled={busy || loadingDocument || selected.length === 0} onClick={validateBeforeConfirm} className="rounded-xl bg-[#5750f1] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Procesando..." : loadingDocument ? "Abriendo documento..." : actionLabel}</button></div>
      {message && <p role="status" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{message}</p>}
    </section>
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5750f1]">Revisión antes de confirmar</p><h2 className="mt-2 text-xl font-black text-slate-800">¿Confirmar {title.toLowerCase()}?</h2></div><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X size={19} /></button></div><div className="mt-5 rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-4 text-sm text-slate-700"><p><strong>{selected.length}</strong> equipo(s) seleccionado(s)</p>{operation !== "credit" && <p className="mt-1">{label}: <strong>{counterparty}</strong></p>}{needsReason && <p className="mt-1">{reasonLabel}: <strong>{reason}</strong></p>}</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Volver</button><button type="button" onClick={submit} disabled={busy} className="rounded-xl bg-[#5750f1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#463ec5] disabled:opacity-50">Confirmar y generar documento</button></div></div></div>}
    {document && <WarrantyDocumentPreviewModal document={document} onClose={() => setDocument(null)} />}
  </>;
}
