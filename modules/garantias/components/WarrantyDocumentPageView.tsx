"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Check,
  Copy,
  Eye,
  FileText,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tag,
  User,
} from "lucide-react";
import { formatDateRD } from "@/lib/utils/format";
import { WarrantyDocumentPreviewModal } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";
import { WarrantyDocumentActions } from "@/modules/garantias/components/WarrantyDocumentActions";
import { WARRANTY_DOCUMENT_LABELS } from "@/modules/garantias/lib/status-machine";

export function WarrantyDocumentPageView({ doc }: { doc: any }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = WARRANTY_DOCUMENT_LABELS[doc.type] ?? doc.type.replaceAll("_", " ");

  const handleCopyCode = () => {
    navigator.clipboard.writeText(doc.documentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <WarrantyDocumentActions
        documentCode={doc.documentCode}
        onPreview={() => setPreviewOpen(true)}
      />

      <article className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm print:rounded-none print:border-none print:shadow-none">
        {/* Document Header */}
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 text-white sm:flex-row sm:items-start sm:p-8 print:bg-none print:text-black">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl font-black text-slate-950 shadow-md">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Señal Digital</h1>
              <p className="text-xs font-semibold text-slate-300">
                Garantías y Servicio Técnico Especializado
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                La Romana, República Dominicana
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-xs">
              <span>{label}</span>
            </div>
            <div className="mt-2 flex items-center justify-start gap-2 sm:justify-end">
              <p className="font-mono text-xl font-black tracking-tight text-indigo-200">
                {doc.documentCode}
              </p>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copiar código"
                className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white print:hidden"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-300">
              <Calendar size={13} />
              {formatDateRD(doc.documentDate)}
            </p>
          </div>
        </header>

        {/* Info Grid */}
        <div className="grid gap-4 border-b border-slate-100 bg-slate-50/60 p-6 text-xs sm:grid-cols-3 sm:p-7">
          <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-2xs">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Tipo de Documento
            </p>
            <p className="mt-1 font-bold text-slate-900">{label}</p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-2xs">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Destinatario / Contraparte
            </p>
            <p className="mt-1 font-bold text-slate-900">
              {doc.counterpartyName || "Garantía interna"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-2xs">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Registrado Por
            </p>
            <p className="mt-1 font-bold text-slate-900">
              {doc.createdBy?.name || "Sistema"}
            </p>
          </div>
        </div>

        {/* Devices Table */}
        <div className="p-6 sm:p-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Equipos incluidos en este documento ({doc.items?.length || 0})
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/80 font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Caso</th>
                  <th className="px-4 py-3">Equipo / Modelo</th>
                  <th className="px-4 py-3">IMEI</th>
                  <th className="px-4 py-3">Problema Reportado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doc.items?.map((entry: any, index: number) => (
                  <tr key={entry.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-bold text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/garantias/${entry.case.caseCode}`}
                        className="font-mono font-bold text-indigo-600 hover:underline"
                      >
                        {entry.case.caseCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <strong className="block text-slate-800">{entry.case.model}</strong>
                      <span className="text-[11px] text-slate-500">{entry.case.clientName}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {entry.case.imei}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.case.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes if present */}
          {doc.notes && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-bold text-slate-900">Observaciones / Notas:</p>
              <p className="mt-1">{doc.notes}</p>
            </div>
          )}

          {/* Bottom Actions card */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900 print:hidden">
            <span className="font-medium">
              Total de <strong>{doc.items?.length || 0}</strong> equipo(s) avalados por este comprobante.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700"
              >
                <Eye size={14} />
                Abrir Vista PDF
              </button>
            </div>
          </div>

          {/* Signatures for print */}
          <div className="hidden print:grid print:grid-cols-2 print:gap-12 print:pt-20 print:text-center print:text-xs print:text-slate-600">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold">Entrega / Responsable</p>
              <p className="mt-1 text-[10px] text-slate-400">Firma y cédula</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold">Recibido Conforme</p>
              <p className="mt-1 text-[10px] text-slate-400">Firma y fecha</p>
            </div>
          </div>
        </div>
      </article>

      {previewOpen && (
        <WarrantyDocumentPreviewModal document={doc} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
