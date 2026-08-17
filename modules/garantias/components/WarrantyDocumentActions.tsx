"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Printer, Shield } from "lucide-react";

export function WarrantyDocumentActions({
  onPreview,
  documentCode,
}: {
  onPreview?: () => void;
  documentCode?: string;
}) {
  const router = useRouter();

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <button
        type="button"
        onClick={() => router.push("/garantias/historial/documentos")}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-98"
      >
        <ArrowLeft size={15} />
        Volver al Historial
      </button>

      <div className="flex items-center gap-2">
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-100 active:scale-98"
          >
            <Eye size={15} />
            Vista Previa / PDF
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 active:scale-98"
        >
          <Printer size={15} />
          Imprimir Documento
        </button>
      </div>
    </div>
  );
}
