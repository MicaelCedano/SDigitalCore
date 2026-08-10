import type { WarrantyStatus } from "@prisma/client";

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  RECEIVED: "Recibido",
  IN_REPAIR: "En reparación",
  RECEIVED_FROM_TECHNICIAN: "Recibido del técnico",
  SENT_TO_SUPPLIER: "Enviado al suplidor",
  RECEIVED_FROM_SUPPLIER: "Recibido del suplidor",
  DELIVERED: "Entregado",
  CREDIT_NOTE: "Nota de crédito",
};

export const WARRANTY_STATUS_TONES: Record<WarrantyStatus, string> = {
  RECEIVED: "bg-blue-50 text-blue-700",
  IN_REPAIR: "bg-amber-50 text-amber-700",
  RECEIVED_FROM_TECHNICIAN: "bg-violet-50 text-violet-700",
  SENT_TO_SUPPLIER: "bg-orange-50 text-orange-700",
  RECEIVED_FROM_SUPPLIER: "bg-cyan-50 text-cyan-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CREDIT_NOTE: "bg-slate-100 text-slate-600",
};

const transitions: Record<WarrantyStatus, WarrantyStatus[]> = {
  RECEIVED: ["IN_REPAIR", "SENT_TO_SUPPLIER", "DELIVERED"],
  IN_REPAIR: ["RECEIVED_FROM_TECHNICIAN", "RECEIVED", "SENT_TO_SUPPLIER"],
  RECEIVED_FROM_TECHNICIAN: ["SENT_TO_SUPPLIER", "DELIVERED"],
  SENT_TO_SUPPLIER: ["RECEIVED_FROM_SUPPLIER"],
  RECEIVED_FROM_SUPPLIER: ["IN_REPAIR", "DELIVERED"],
  DELIVERED: [],
  CREDIT_NOTE: [],
};

export function canTransition(from: WarrantyStatus, to: WarrantyStatus) {
  return transitions[from].includes(to);
}

export function getWarrantyStatusLabel(status: WarrantyStatus) {
  return WARRANTY_STATUS_LABELS[status];
}
