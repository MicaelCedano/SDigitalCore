import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ajustes Generales | SDigitalCore" };

export default function Page() {
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <span className="text-xs font-semibold text-indigo-600 font-mono">Configuración / Ajustes Generales</span>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Ajustes Generales</h1>
        <p className="text-xs text-slate-500 mt-1">Sub-módulo oficial de Configuración.</p>
      </div>
    </div>
  );
}
