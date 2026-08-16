"use client";

import { useState } from "react";
import { PiggyBank, X, Sparkles } from "lucide-react";
import { createSavingsAccountAction } from "@/modules/wallet/actions/accounts";

interface CreateAccountModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateAccountModal({ onClose, onSuccess }: CreateAccountModalProps) {
  const [name, setName] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Indica el nombre de la cuenta.");
      return;
    }

    setLoading(true);
    setError(null);

    const goalNum = savingsGoal.trim() ? Number(savingsGoal.replace(/,/g, "")) : null;
    if (goalNum !== null && (isNaN(goalNum) || goalNum <= 0)) {
      setLoading(false);
      setError("La meta de ahorro debe ser un monto válido mayor a 0.");
      return;
    }

    const result = await createSavingsAccountAction({
      name: name.trim(),
      savingsGoal: goalNum,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSuccess?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10">
              <PiggyBank size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Nueva Cuenta de Ahorro</h3>
              <p className="text-xs text-slate-500">Crea una subcuenta para organizar tus metas.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="account-name" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Nombre de la cuenta
            </label>
            <input
              id="account-name"
              type="text"
              required
              autoFocus
              maxLength={80}
              placeholder="Ej. Ahorro para el carro, Fondo personal..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
            />
          </div>

          <div>
            <label htmlFor="account-goal" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Meta de ahorro <span className="text-[11px] font-normal normal-case text-slate-400">(Opcional)</span>
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3.5 top-3 text-xs font-bold text-slate-400">RD$</span>
              <input
                id="account-goal"
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                value={savingsGoal}
                onChange={(e) => setSavingsGoal(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-3.5 font-mono text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Te mostrará una barra de progreso conforme transfieras fondos hacia esta cuenta.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear Cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
