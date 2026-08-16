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

export function WarrantyQuickActions({
  cases,
  canCreate,
  canTransition,
}: {
  cases: Partial<Record<WarrantyFlowOperation, WarrantyFlowCase[]>>;
  canCreate: boolean;
  canTransition: boolean;
}) {
  const [openOperation, setOpenOperation] = useState<WarrantyFlowOperation | null>(null);
  const [initialSelected, setInitialSelected] = useState<string[]>([]);
  const [defaultCounterparty, setDefaultCounterparty] = useState("");
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

    const handleOpenFlow = (event: Event) => {
      const customEvent = event as CustomEvent<{
        operation: WarrantyFlowOperation;
        caseCode?: string;
        counterparty?: string;
      }>;
      if (customEvent.detail?.operation) {
        setOpenOperation(customEvent.detail.operation);
        if (customEvent.detail.caseCode) {
          setInitialSelected([customEvent.detail.caseCode]);
        } else {
          setInitialSelected([]);
        }
        if (customEvent.detail.counterparty) {
          setDefaultCounterparty(customEvent.detail.counterparty);
        } else {
          setDefaultCounterparty("");
        }
      }
    };

    window.addEventListener("open-warranty-intake", openIntake);
    window.addEventListener("open-warranty-flow", handleOpenFlow as EventListener);
    if (canCreate) document.addEventListener("click", interceptRegisterLink, true);

    return () => {
      window.removeEventListener("open-warranty-intake", openIntake);
      window.removeEventListener("open-warranty-flow", handleOpenFlow as EventListener);
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
      // Atajo 'n' para nuevo ingreso si no se está escribiendo en un input
      if (
        (e.key === "n" || e.key === "N") &&
        !intakeOpen &&
        !openOperation &&
        canCreate &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement instanceof HTMLSelectElement
        )
      ) {
        e.preventDefault();
        setIntakeOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canCreate, intakeOpen, openOperation]);

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
            title="Registrar ingreso (Atajo: tecla N)"
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
                            setInitialSelected([]);
                            setDefaultCounterparty("");
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
                              <span className="block truncate text-xs font-semibold text-slate-700">
                                {label}
                              </span>
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

      {/* Modal Centrado para Registrar Ingreso */}
      {intakeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar ingreso"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Registrar Ingreso de Garantía</h2>
                  <p className="text-xs text-slate-500">
                    Crea uno o varios casos para el mismo cliente y genera el recibo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIntakeOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              <WarrantyIntakeForm embedded />
            </div>
          </div>
        </div>
      )}

      {/* Modal Centrado para Operaciones de Flujo */}
      {active && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            role="dialog"
            aria-modal="true"
            aria-label={active.label}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
                  <active.icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{active.label}</h2>
                  <p className="text-xs text-slate-500">{active.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenOperation(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              <WarrantyFlow
                operation={active.operation}
                cases={activeCases}
                defaultCounterparty={defaultCounterparty}
                initialSelectedCases={initialSelected}
                embedded
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
