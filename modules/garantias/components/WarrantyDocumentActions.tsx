"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Printer } from "lucide-react";

export function WarrantyDocumentActions({ onPreview }: { onPreview?: () => void }) {
  const router = useRouter();
  return <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden"><button type="button" onClick={() => router.push("/garantias/historial/documentos")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} /> Historial</button>{onPreview && <button type="button" onClick={onPreview} className="inline-flex items-center gap-2 rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 px-3 py-2 text-sm font-bold text-[#5750f1]"><Eye size={16} /> Ver PDF</button>}<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#5750f1] px-3 py-2 text-sm font-bold text-white shadow-md shadow-[#5750f1]/20 hover:bg-[#463ec5]"><Printer size={16} /> Imprimir</button></div>;
}
