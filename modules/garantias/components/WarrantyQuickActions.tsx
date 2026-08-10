"use client";

import { useEffect, useState } from "react";
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

export function WarrantyQuickActions({ cases, canCreate, canTransition }: { cases: Partial<Record<WarrantyFlowOperation, WarrantyFlowCase[]>>; canCreate: boolean; canTransition: boolean }) {
  const [openOperation, setOpenOperation] = useState<WarrantyFlowOperation | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const active = actions.find((item) => item.operation === openOperation);
  const activeCases = openOperation ? cases[openOperation] ?? [] : [];

  useEffect(() => {
    const openIntake = () => setIntakeOpen(true);
    const interceptRegisterLink = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a[href="/garantias/ingreso"]');
      if (!link) return;
      event.preventDefault();
      setIntakeOpen(true);
    };
    window.addEventListener("open-warranty-intake", openIntake);
    if (canCreate) document.addEventListener("click", interceptRegisterLink, true);
    return () => {
      window.removeEventListener("open-warranty-intake", openIntake);
      document.removeEventListener("click", interceptRegisterLink, true);
    };
  }, [canCreate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOperation(null);
        setIntakeOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="enterprise-panel p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#101828]">Acciones Rápidas del Flujo</h2>
            <p className="text-xs text-[#667085]">Gestiona ingresos y transiciones entre estados directamente en ventana modal.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {canCreate && (
            <button
              type="button"
              onClick={() => setIntakeOpen(true)}
              className="group flex flex-col justify-between rounded-xl bg-indigo-600 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <Plus size={18} />
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">Nuevo</span>
              </div>
              <div className="mt-3">
                <span className="block text-xs font-bold text-white">Registrar Ingreso</span>
                <span className="mt-0.5 block text-[10px] text-indigo-100 opacity-90">Nuevo caso de garantía</span>
              </div>
            </button>
          )}

          {canTransition &&
            actions.map(({ operation, label, icon: Icon, tone }) => {
              const count = cases[operation]?.length ?? 0;
              return (
                <button
                  key={operation}
                  type="button"
                  onClick={() => setOpenOperation(operation)}
                  className="group flex flex-col justify-between rounded-xl border border-[#e4e7ec] bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        tone === "violet"
                          ? "bg-violet-50 text-violet-600 group-hover:bg-violet-100"
                          : tone === "blue"
                          ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                          : tone === "orange"
                          ? "bg-orange-50 text-orange-600 group-hover:bg-orange-100"
                          : tone === "amber"
                          ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                          : tone === "emerald"
                          ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                          : "bg-red-50 text-red-600 group-hover:bg-red-100"
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    {count > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="block truncate text-xs font-semibold text-[#344054] group-hover:text-indigo-600">{label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#98a2b3]">En ventana modal</span>
                  </div>
                </button>
              );
            })}

          {!canCreate && !canTransition && (
            <div className="col-span-full rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Tu rol actual tiene permisos de solo lectura para las operaciones de garantía.
            </div>
          )}
        </div>
      </div>

      {intakeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm transition-all sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar ingreso"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIntakeOpen(false);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-[#f4f7fb] shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-[#e4e7ec] bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Registro Rápido</p>
                <h2 className="mt-0.5 text-xl font-black text-[#101828]">Registrar Ingreso de Garantía</h2>
              </div>
              <button
                type="button"
                onClick={() => setIntakeOpen(false)}
                className="rounded-lg p-2 text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#101828]"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <WarrantyIntakeForm />
            </div>
          </div>
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm transition-all sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenOperation(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-[#f4f7fb] shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-[#e4e7ec] bg-white px-5 py-4 sm:px-7">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-[0.15em] ${
                    active.tone === "violet"
                      ? "text-violet-600"
                      : active.tone === "blue"
                      ? "text-blue-600"
                      : active.tone === "orange"
                      ? "text-orange-600"
                      : active.tone === "amber"
                      ? "text-amber-600"
                      : active.tone === "emerald"
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  Gestión en Lote
                </p>
                <h2 className="mt-0.5 text-xl font-black text-[#101828]">{active.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenOperation(null)}
                className="rounded-lg p-2 text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#101828]"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <WarrantyFlow operation={active.operation} cases={activeCases} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
