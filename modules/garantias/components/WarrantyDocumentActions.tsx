"use client";
import { useRouter } from "next/navigation";
export function WarrantyDocumentActions() { const router = useRouter(); return <div className="mb-4 flex justify-end gap-2 print:hidden"><button type="button" onClick={() => router.push("/garantias")} className="rounded-lg border px-3 py-2 text-sm">Cerrar</button><button type="button" onClick={() => window.print()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Imprimir</button></div>; }
