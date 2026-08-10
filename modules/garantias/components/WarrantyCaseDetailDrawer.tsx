"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import { WarrantyArchiveButton } from "@/modules/garantias/components/WarrantyArchiveButton";
import { WarrantyCaseEditButton } from "@/modules/garantias/components/WarrantyCaseEditButton";
import { WarrantyStatusBadge } from "@/modules/garantias/components/WarrantyStatusBadge";
import { WARRANTY_STATUS_LABELS } from "@/modules/garantias/lib/status-machine";

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
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!item) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    };
  }, [item, onClose]);

  if (!item) return null;

  function copyToClipboard(text: string, field: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.55)] sm:max-h-[calc(100vh-3rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="warranty-detail-title"
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
              <ShieldCheck size={23} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="warranty-detail-title"
                  className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-2xl"
                >
                  Detalle de {item.caseCode}
                </h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.caseCode, "code")}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                  title="Copiar código de garantía"
                  aria-label="Copiar código de garantía"
                >
                  {copiedField === "code" ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500 sm:text-sm">
                Garantía · {item.clientName} · {formatDate(item.entryDate)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cerrar detalle de garantía"
          >
            <X size={21} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado</p>
              <div className="mt-2.5"><WarrantyStatusBadge status={item.status} /></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cliente</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserRound size={16} className="shrink-0 text-red-600" />
                <span className="truncate">{item.clientName}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fecha de admisión</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Calendar size={16} className="shrink-0 text-red-600" />
                {formatDate(item.entryDate)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Registro</p>
              <p className={`mt-2 text-sm font-bold ${item.archivedAt ? "text-slate-600" : "text-emerald-700"}`}>
                {item.archivedAt ? "Caso archivado" : "Caso activo"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/45 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-red-700">
              <ClipboardList size={15} /> Falla reportada
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800 sm:text-base">
              {item.problem}
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700">
                <Smartphone size={16} className="text-red-600" /> Equipo recibido
              </p>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">1 equipo</span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[1.15fr_1fr_1fr] bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>IMEI</span>
                <span>Modelo / equipo</span>
                <span>Cliente</span>
              </div>
              <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1.15fr_1fr_1fr] sm:items-center sm:gap-0">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">IMEI</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{item.imei}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.imei, "imei")}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                      aria-label="Copiar IMEI"
                      title="Copiar IMEI"
                    >
                      {copiedField === "imei" ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">Modelo / equipo</p>
                  <p className="text-sm font-bold text-slate-900">{item.model}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400 sm:hidden">Cliente</p>
                  <p className="text-sm font-semibold text-slate-700">{item.clientName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <WarrantyCaseEditButton item={item} />
            <WarrantyArchiveButton caseCode={item.caseCode} archived={Boolean(item.archivedAt)} />
          </div>
          <Link
            href={`/garantias/${item.caseCode}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
          >
            Ver expediente completo <ArrowUpRight size={16} />
          </Link>
        </footer>
      </section>
    </div>
  );
}
