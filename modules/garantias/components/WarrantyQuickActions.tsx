"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck2, Plus, Truck, UserRoundCheck, Wrench, X } from "lucide-react";
import { WarrantyFlow, type WarrantyFlowCase, type WarrantyFlowOperation } from "@/modules/garantias/components/WarrantyFlow";
import { WarrantyIntakeForm } from "@/modules/garantias/components/WarrantyIntakeForm";

const actions: Array<{ operation: WarrantyFlowOperation; label: string; description: string; icon: typeof UserRoundCheck; tone: string }> = [
  { operation: "assign", label: "Enviar a técnico", description: "Selecciona equipos recibidos y genera el conduce.", icon: UserRoundCheck, tone: "violet" },
  { operation: "receiveTech", label: "Recibir del técnico", description: "Registra equipos reparados o no reparados.", icon: Wrench, tone: "blue" },
  { operation: "sendSupplier", label: "Enviar a suplidor", description: "Despacha equipos a marca o proveedor.", icon: Truck, tone: "orange" },
  { operation: "receiveSupplier", label: "Recibir de suplidor", description: "Registra el retorno del proveedor.", icon: FileCheck2, tone: "amber" },
  { operation: "deliver", label: "Despachar al cliente", description: "Entrega los equipos listos al cliente.", icon: CheckCircle2, tone: "emerald" },
  { operation: "credit", label: "Crear nota de crédito", description: "Cierra un caso abierto con su motivo.", icon: FileCheck2, tone: "red" },
];

export function WarrantyQuickActions({ cases, canCreate }: { cases: Partial<Record<WarrantyFlowOperation, WarrantyFlowCase[]>>; canCreate: boolean }) {
  const [openOperation, setOpenOperation] = useState<WarrantyFlowOperation | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const active = actions.find((item) => item.operation === openOperation);
  const activeCases = openOperation ? cases[openOperation] ?? [] : [];

  return <>
    <aside className="enterprise-panel h-fit p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#101828]">Acciones rápidas</h2><p className="mt-1 text-xs text-[#667085]">Gestiona el flujo sin cambiar de página.</p></div><CheckCircle2 size={18} className="text-red-500" /></div><div className="mt-4 space-y-2">{canCreate && <button type="button" onClick={() => setIntakeOpen(true)} className="flex w-full items-center justify-between rounded-lg bg-indigo-600 px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-indigo-700"><span className="flex items-center gap-2"><Plus size={16} /> Registrar ingreso</span><span className="text-xs opacity-70">Popup</span></button>}{actions.map(({ operation, label, description, icon: Icon, tone }) => <button key={operation} type="button" onClick={() => setOpenOperation(operation)} className="flex w-full items-center gap-3 rounded-lg border border-[#e4e7ec] px-3 py-3 text-left transition hover:border-red-200 hover:bg-red-50/40"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "orange" ? "bg-orange-50 text-orange-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#344054]">{label}</span><span className="mt-0.5 block text-[11px] text-[#98a2b3]">{description}</span></span><span className="text-xs font-bold text-red-600">Popup</span></button>)}</div></aside>
    {intakeOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Registrar ingreso"><div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-[#f4f7fb] shadow-2xl"><div className="flex items-center justify-between border-b border-[#e4e7ec] bg-white px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Operación rápida</p><h2 className="mt-1 text-xl font-black text-[#101828]">Registrar ingreso de garantía</h2></div><button type="button" onClick={() => setIntakeOpen(false)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7]" aria-label="Cerrar popup"><X size={20} /></button></div><div className="p-3 sm:p-6"><WarrantyIntakeForm /></div></div></div>}
    {active && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={active.label}><div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-[#f4f7fb] shadow-2xl"><div className="flex items-center justify-between border-b border-[#e4e7ec] bg-white px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">Operación rápida</p><h2 className="mt-1 text-xl font-black text-[#101828]">{active.label}</h2></div><button type="button" onClick={() => setOpenOperation(null)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7]" aria-label="Cerrar popup"><X size={20} /></button></div><div className="p-3 sm:p-6"><WarrantyFlow operation={active.operation} cases={activeCases} /></div></div></div>}
  </>;
}
