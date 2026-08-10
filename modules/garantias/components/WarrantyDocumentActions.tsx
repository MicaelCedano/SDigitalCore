"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Printer } from "lucide-react";

export function WarrantyDocumentActions({ onPreview }: { onPreview?: () => void }) {
  const router = useRouter();
  return <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden"><button type="button" onClick={() => router.push("/garantias/historial/documentos")} className="inline-flex items-center gap-2 rounded-xl border border-[#d0d5dd] px-3 py-2 text-sm font-semibold text-[#344054]"><ArrowLeft size={16} /> Historial</button>{onPreview && <button type="button" onClick={onPreview} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"><Eye size={16} /> Ver PDF</button>}<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white"><Printer size={16} /> Imprimir</button></div>;
}
