"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calendar, Check, Copy, X } from "lucide-react";
import { WarrantyStatusBadge } from "@/modules/garantias/components/WarrantyStatusBadge";
import { WARRANTY_STATUS_LABELS } from "@/modules/garantias/lib/status-machine";
import { WarrantyCaseEditButton } from "@/modules/garantias/components/WarrantyCaseEditButton";
import { WarrantyArchiveButton } from "@/modules/garantias/components/WarrantyArchiveButton";

export type DetailCaseRow = {
  id: string;
  caseCode: string;
  imei: string;
  model: string;
  clientName: string;
  problem: string;
  status: keyof typeof WARRANTY_STATUS_LABELS;
  entryDate: string | Date;
  archivedAt: string | Date | null;
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Santo_Domingo",
  });
}

export function WarrantyCaseDetailDrawer({
  item,
  onClose,
}: {
  item: DetailCaseRow | null;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  function copyToClipboard(text: string, field: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#e4e7ec] bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-right sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${item.caseCode}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#e4e7ec] bg-[#f8fafc] px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
              Terminal de Control
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="font-mono text-xl font-black text-[#101828]">{item.caseCode}</h2>
              <button
                type="button"
                onClick={() => copyToClipboard(item.caseCode, "code")}
                className="rounded-md p-1 text-[#98a2b3] transition hover:bg-slate-200 hover:text-[#101828]"
                title="Copiar código de caso"
              >
                {copiedField === "code" ? (
                  <Check size={15} className="text-emerald-600" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#667085] transition hover:bg-slate-200 hover:text-[#101828]"
            aria-label="Cerrar detalles"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Status Box */}
          <div className="rounded-2xl border border-[#e4e7ec] bg-[#fcfcfd] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">
              Estado de la reparación
            </p>
            <div className="mt-2 flex items-center justify-between">
              <WarrantyStatusBadge status={item.status} />
              {item.archivedAt && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Archivado
                </span>
              )}
            </div>
          </div>

          {/* Device details */}
          <div className="space-y-4 rounded-2xl border border-[#e4e7ec] bg-white p-4">
            {/* IMEI */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">IMEI</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-base font-bold text-[#101828]">{item.imei}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.imei, "imei")}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {copiedField === "imei" ? (
                    <>
                      <Check size={14} className="text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copiar IMEI
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Model */}
            <div className="border-t border-[#f0f1f3] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">
                Modelo / Equipo
              </p>
              <p className="mt-1 text-sm font-bold text-[#101828]">{item.model}</p>
            </div>

            {/* Client */}
            <div className="border-t border-[#f0f1f3] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">Cliente</p>
              <p className="mt-1 text-sm font-semibold text-[#344054]">{item.clientName}</p>
            </div>

            {/* Date */}
            <div className="border-t border-[#f0f1f3] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">
                Fecha de admisión
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#344054]">
                <Calendar size={14} className="text-[#98a2b3]" />
                {formatDate(item.entryDate)}
              </p>
            </div>
          </div>

          {/* Problem / Diagnosis */}
          <div className="rounded-2xl border border-[#e4e7ec] bg-[#f8fafc] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#98a2b3]">
              Diagnóstico / Falla reportada
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#344054]">
              {item.problem}
            </p>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="space-y-2 border-t border-[#e4e7ec] bg-white p-4 sm:p-6">
          <Link
            href={`/garantias/${item.caseCode}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-center text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700"
          >
            Ver detalle completo <ArrowUpRight size={15} />
          </Link>

          <div className="flex items-center justify-between gap-2 pt-1">
            <WarrantyCaseEditButton item={item} />
            <WarrantyArchiveButton
              caseCode={item.caseCode}
              archived={Boolean(item.archivedAt)}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
