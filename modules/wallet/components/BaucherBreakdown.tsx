"use client";

/**
 * Desglose de conceptos para el baucher de pago — muestra POR QUÉ se le paga:
 * X de desbloqueos, X de revisión de teléfonos, X de reparaciones, otros.
 * Se renderiza DENTRO del JPG del baucher (por eso va sin interactividad).
 */

export interface WalletBreakdown {
  desbloqueos: { count: number; amount: number };
  revisiones: { count: number; amount: number };
  reparaciones: { count: number; amount: number };
  otros: { count: number; amount: number };
  total: number;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(value);
}

export function BaucherBreakdown({ breakdown }: { breakdown: WalletBreakdown }) {
  const items: Array<{ label: string; count: number; amount: number }> = [
    { label: "Desbloqueos", count: breakdown.desbloqueos.count, amount: breakdown.desbloqueos.amount },
    { label: "Revisión de teléfonos", count: breakdown.revisiones.count, amount: breakdown.revisiones.amount },
    { label: "Reparaciones", count: breakdown.reparaciones.count, amount: breakdown.reparaciones.amount },
    { label: "Otros conceptos", count: breakdown.otros.count, amount: breakdown.otros.amount },
  ];
  const visible = items.filter((item) => item.amount > 0);

  if (visible.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <p className="mb-2 text-[9px] font-black tracking-widest text-slate-400 uppercase">
        Desglose del pago (por qué se paga)
      </p>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-slate-600">
              {item.label}
              {item.count > 0 ? <span className="ml-1 text-slate-400">({item.count})</span> : null}
            </span>
            <span className="font-mono text-[11px] font-black text-slate-800">{money(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
