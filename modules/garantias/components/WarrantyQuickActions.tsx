"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
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
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalPendingTransitions = useMemo(() => {
    return Object.values(cases).reduce((acc, curr) => acc + (curr?.length ?? 0), 0);
  }, [cases]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5750f1] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#463ec5] active:scale-[0.98]"
          >
            <Plus size={17} /> Registrar ingreso
          </button>
        )}

        {canTransition && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              Acciones de flujo
              {totalPendingTransitions > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5750f1]/10 px-1.5 text-xs font-bold text-[#5750f1]">
                  {totalPendingTransitions}
                </span>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                  <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Procesamiento por etapas
                  </p>
                  <div className="space-y-1">
                    {actions.map(({ operation, label, description, icon: Icon, tone }) => {
                      const count = cases[operation]?.length ?? 0;
                      return (
                        <button
                          key={operation}
                          type="button"
                          onClick={() => {
                            setOpenOperation(operation);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                tone === "violet"
                                  ? "bg-violet-50 text-violet-600"
                                  : tone === "blue"
                                  ? "bg-blue-50 text-blue-600"
                                  : tone === "orange"
                                  ? "bg-orange-50 text-orange-600"
                                  : tone === "amber"
                                  ? "bg-amber-50 text-amber-600"
                                  : tone === "emerald"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-700">{label}</span>
                            </span>
                          </div>
                          {count > 0 && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Drawer Lateral Derecho para Registrar Ingreso */}
      {intakeOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIntakeOpen(false)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#f4f7fb] shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-3xl border-l border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar ingreso"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#5750f1]/10 px-2.5 py-1 text-xs font-bold text-[#5750f1]">
                  Garantías
                </span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-semibold text-slate-700">Registrar Ingreso</span>
              </div>
              <button
                type="button"
                onClick={() => setIntakeOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar panel lateral"
              >
                <X size={19} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <WarrantyIntakeForm />
            </div>
          </aside>
        </>
      )}

      {/* Drawer Lateral Derecho para Operaciones de Flujo */}
      {active && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setOpenOperation(null)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#f4f7fb] shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-3xl border-l border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-label={active.label}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#5750f1]/10 px-2.5 py-1 text-xs font-bold text-[#5750f1]">
                  Garantías
                </span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-semibold text-slate-700">{active.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenOperation(null)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar panel lateral"
              >
                <X size={19} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <WarrantyFlow operation={active.operation} cases={activeCases} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
