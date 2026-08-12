"use client";

import { useEffect, useState } from "react";
import {
  BatteryMedium,
  CheckCircle2,
  ClipboardCheck,
  CircleHelp,
  ShieldAlert,
  X,
  User,
  Calendar,
  Package,
  StickyNote,
} from "lucide-react";
import { formatDateTimeRD } from "@/lib/utils/format";

export type ReviewedInspection = {
  id: string;
  result: "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | null;
  grade: string | null;
  batteryHealth: number | null;
  functionalityNotes: string | null;
  physicalNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  reviewerNameSnapshot: string;
  reviewerId: string | null;
  reviewer: { id: string; name: string | null; username: string | null } | null;
  device: {
    id: string;
    imei: string | null;
    serialNumber: string | null;
    brand: string | null;
    model: string;
    storageGb: number | null;
    color: string | null;
    status: string;
    batch: { batchNumber: string; supplierName: string; status: string } | null;
  };
};

const DEVICE_STATUS_LABEL: Record<string, string> = {
  PENDING_QC: "Pendiente de QC",
  IN_QC: "En QC",
  AVAILABLE: "Disponible",
  QUARANTINED: "En cuarentena",
  ARCHIVED: "Archivado",
};

function resultLabel(result: ReviewedInspection["result"]) {
  if (result === "FUNCTIONAL") return "Funcional";
  if (result === "NON_FUNCTIONAL") return "No funcional";
  return "Sin clasificación";
}

function resultTone(result: ReviewedInspection["result"]) {
  if (result === "FUNCTIONAL") return "border-[#abefc6] bg-[#ecfdf3] text-[#067647]";
  if (result === "NON_FUNCTIONAL") return "border-[#fecdca] bg-[#fef3f2] text-[#b42318]";
  return "border-[#fedf89] bg-[#fffaeb] text-[#b54708]";
}

function ResultIcon({ result }: { result: ReviewedInspection["result"] }) {
  if (result === "FUNCTIONAL") return <CheckCircle2 className="w-4 h-4" />;
  if (result === "NON_FUNCTIONAL") return <ShieldAlert className="w-4 h-4" />;
  return <CircleHelp className="w-4 h-4" />;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f4f7] text-[#667085]">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-[#344054]">{children}</div>
      </div>
    </div>
  );
}

export function ReviewedDevicesTable({ inspections }: { inspections: ReviewedInspection[] }) {
  const [selected, setSelected] = useState<ReviewedInspection | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
            <tr>
              <th className="px-6 py-3">Equipo</th>
              <th className="px-4 py-3">Identificador</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Calidad</th>
              <th className="px-4 py-3">Revisado por</th>
              <th className="px-6 py-3 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaecf0]">
            {inspections.map((inspection) => (
              <tr
                key={inspection.id}
                onClick={() => setSelected(inspection)}
                title="Ver detalle de la revisión"
                className="cursor-pointer hover:bg-[#fcfcfd]"
              >
                <td className="px-6 py-4">
                  <p className="font-semibold text-[#101828]">
                    {[inspection.device.brand, inspection.device.model].filter(Boolean).join(" ")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {[inspection.device.storageGb ? `${inspection.device.storageGb} GB` : null, inspection.device.color]
                      .filter(Boolean)
                      .join(" · ") || "Sin detalles adicionales"}
                  </p>
                </td>
                <td className="px-4 py-4 font-mono text-xs font-semibold text-[#344054]">
                  {inspection.device.imei ?? inspection.device.serialNumber ?? "—"}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${resultTone(inspection.result)}`}>
                    {resultLabel(inspection.result)}
                  </span>
                </td>
                <td className="px-4 py-4 text-[#475467]">
                  <span className="font-semibold text-[#344054]">
                    {inspection.grade ? `Grado ${inspection.grade}` : "Sin grado"}
                  </span>
                  {inspection.batteryHealth !== null ? (
                    <span className="ml-2 text-xs">· {inspection.batteryHealth}% batería</span>
                  ) : null}
                </td>
                <td className="px-4 py-4 font-medium text-[#344054]">{inspection.reviewerNameSnapshot}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-[#667085]">
                  {inspection.reviewedAt ? formatDateTimeRD(inspection.reviewedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e4e7ec] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#eaecf0] flex items-center justify-between bg-[#fcfcfd]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <ClipboardCheck size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[#101828]">Detalle de la revisión</h2>
                  <p className="font-mono text-xs text-[#667085]">
                    {selected.device.imei ?? selected.device.serialNumber ?? "Sin identificador"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Equipo */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-[#101828]">
                  {[selected.device.brand, selected.device.model].filter(Boolean).join(" ")}
                </p>
                {selected.device.storageGb ? (
                  <span className="rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-2.5 py-0.5 text-xs font-semibold text-[#475467]">
                    {selected.device.storageGb} GB
                  </span>
                ) : null}
                {selected.device.color ? (
                  <span className="rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-2.5 py-0.5 text-xs font-semibold text-[#475467]">
                    {selected.device.color}
                  </span>
                ) : null}
                <span className="rounded-full border border-[#e4e7ec] bg-[#fcfcfd] px-2.5 py-0.5 text-xs font-semibold text-[#667085]">
                  {DEVICE_STATUS_LABEL[selected.device.status] ?? selected.device.status}
                </span>
              </div>

              {/* Resultado */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${resultTone(selected.result)}`}>
                  <ResultIcon result={selected.result} />
                  {resultLabel(selected.result)}
                </span>
                <span className="text-sm font-semibold text-[#344054]">
                  {selected.grade ? `Grado ${selected.grade}` : "Sin grado"}
                </span>
                {selected.batteryHealth !== null ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#667085]">
                    <BatteryMedium className="w-3.5 h-3.5" /> {selected.batteryHealth}%
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow icon={User} label="Revisado por">
                  <span className="font-semibold text-[#101828]">{selected.reviewerNameSnapshot}</span>
                  {selected.reviewer?.username ? (
                    <span className="block text-xs text-[#667085]">@{selected.reviewer.username}</span>
                  ) : null}
                </DetailRow>
                <DetailRow icon={Calendar} label="Revisado el">
                  {selected.reviewedAt ? formatDateTimeRD(selected.reviewedAt) : "—"}
                </DetailRow>
                <DetailRow icon={Package} label="Lote de origen">
                  {selected.device.batch ? (
                    <>
                      <span className="font-semibold text-[#101828]">{selected.device.batch.batchNumber}</span>
                      {selected.device.batch.supplierName ? (
                        <span className="block text-xs text-[#667085]">{selected.device.batch.supplierName}</span>
                      ) : null}
                    </>
                  ) : (
                    "Sin lote"
                  )}
                </DetailRow>
                <DetailRow icon={Calendar} label="Registrado el">
                  {formatDateTimeRD(selected.createdAt)}
                </DetailRow>
              </div>

              {(selected.functionalityNotes || selected.physicalNotes) && (
                <div className="space-y-3">
                  {selected.functionalityNotes ? (
                    <div className="rounded-xl border border-[#e4e7ec] bg-[#fcfcfd] p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                        <StickyNote className="w-3.5 h-3.5" /> Notas de funcionalidad
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#344054]">{selected.functionalityNotes}</p>
                    </div>
                  ) : null}
                  {selected.physicalNotes ? (
                    <div className="rounded-xl border border-[#e4e7ec] bg-[#fcfcfd] p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                        <StickyNote className="w-3.5 h-3.5" /> Notas físicas
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#344054]">{selected.physicalNotes}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="border-t border-[#eaecf0] bg-[#fcfcfd] px-6 py-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2.5 text-xs font-bold text-[#344054] hover:bg-[#f2f4f7] rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
