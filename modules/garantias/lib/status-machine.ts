import type { WarrantyStatus } from "@prisma/client";

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  RECEIVED: "Recibido",
  IN_REPAIR: "En reparación",
  TECHNICIAN_REPORTED_REPAIRED: "Técnico reportó reparado · pendiente de confirmación",
  TECHNICIAN_REPORTED_UNREPAIRED: "Técnico reportó sin reparar · pendiente de confirmación",
  RECEIVED_FROM_TECHNICIAN: "Recibido del técnico",
  SENT_TO_SUPPLIER: "Enviado al suplidor",
  RECEIVED_FROM_SUPPLIER: "Recibido del suplidor",
  READY_FOR_CUSTOMER: "Listo para entregar al cliente",
  DELIVERED: "Entregado",
  CREDIT_NOTE: "Nota de crédito",
};

export const WARRANTY_STATUS_TONES: Record<WarrantyStatus, string> = {
  RECEIVED: "border-blue-200 bg-blue-50 text-blue-700",
  IN_REPAIR: "border-amber-200 bg-amber-50 text-amber-700",
  TECHNICIAN_REPORTED_REPAIRED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  TECHNICIAN_REPORTED_UNREPAIRED: "border-orange-200 bg-orange-50 text-orange-700",
  RECEIVED_FROM_TECHNICIAN: "border-violet-200 bg-violet-50 text-violet-700",
  SENT_TO_SUPPLIER: "border-orange-200 bg-orange-50 text-orange-700",
  RECEIVED_FROM_SUPPLIER: "border-cyan-200 bg-cyan-50 text-cyan-700",
  READY_FOR_CUSTOMER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CREDIT_NOTE: "border-slate-200 bg-slate-100 text-slate-600",
};

const transitions: Record<WarrantyStatus, WarrantyStatus[]> = {
  RECEIVED: ["IN_REPAIR", "SENT_TO_SUPPLIER", "DELIVERED", "CREDIT_NOTE"],
  IN_REPAIR: ["SENT_TO_SUPPLIER", "CREDIT_NOTE"],
  TECHNICIAN_REPORTED_REPAIRED: ["RECEIVED_FROM_TECHNICIAN"],
  TECHNICIAN_REPORTED_UNREPAIRED: ["RECEIVED"],
  RECEIVED_FROM_TECHNICIAN: ["SENT_TO_SUPPLIER", "READY_FOR_CUSTOMER", "CREDIT_NOTE"],
  SENT_TO_SUPPLIER: ["RECEIVED_FROM_SUPPLIER", "CREDIT_NOTE"],
  RECEIVED_FROM_SUPPLIER: ["IN_REPAIR", "READY_FOR_CUSTOMER", "CREDIT_NOTE"],
  READY_FOR_CUSTOMER: ["DELIVERED", "CREDIT_NOTE"],
  DELIVERED: [],
  CREDIT_NOTE: [],
};

export function canTransition(from: WarrantyStatus, to: WarrantyStatus) {
  return transitions[from].includes(to);
}

export function getWarrantyStatusLabel(status: WarrantyStatus) {
  return WARRANTY_STATUS_LABELS[status];
}

export const WARRANTY_EVENT_LABELS: Record<string, string> = {
  CREATED: "Caso recibido",
  DETAILS_UPDATED: "Datos corregidos",
  STATUS_CHANGED: "Estado actualizado",
  ASSIGNED_TO_TECHNICIAN: "Entregado a técnico",
  TECHNICIAN_REPORTED_REPAIRED: "Técnico reportó reparado (pendiente de confirmación)",
  TECHNICIAN_REPORTED_UNREPAIRED: "Técnico reportó sin reparar (pendiente de confirmación)",
  RECEIVED_REPAIRED: "Recibido reparado del técnico",
  RECEIVED_UNREPAIRED: "Recibido sin reparar del técnico",
  SENT_TO_SUPPLIER: "Enviado al suplidor",
  RECEIVED_FROM_SUPPLIER: "Recibido del suplidor",
  READY_FOR_CUSTOMER: "Equipo reparado listo para entregar al cliente",
  DELIVERED_TO_CUSTOMER: "Entregado al cliente",
  CREDIT_NOTE_MARKED: "Cerrado con nota de crédito",
  ARCHIVED: "Caso archivado",
  RESTORED: "Caso restaurado",
};

export const WARRANTY_DOCUMENT_LABELS: Record<string, string> = {
  INTAKE_RECEIPT: "Recibo de ingreso",
  TECHNICIAN_ASSIGNMENT: "Entrega a técnico",
  TECHNICIAN_RECEIPT_REPAIRED: "Recepción de técnico · reparado",
  TECHNICIAN_RECEIPT_UNREPAIRED: "Recepción de técnico · no reparado",
  SUPPLIER_SHIPMENT: "Envío a suplidor",
  SUPPLIER_RECEIPT: "Recepción de suplidor",
  CUSTOMER_DELIVERY: "Entrega al cliente",
  CREDIT_NOTE: "Nota de crédito",
};
