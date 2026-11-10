import { createHash } from "node:crypto";
import type { WarrantyStatus } from "@prisma/client";
import { canTransition } from "@/modules/garantias/lib/status-machine";
import type { FlowOperation } from "@/modules/garantias/actions/warranty";
import { warrantyIdentifierSchema } from "@/lib/validation/warranty";

export const WRITE_ENTITIES = ["garantia", "equipo_qc", "lote_qc", "tarea"] as const;
export type WriteEntity = (typeof WRITE_ENTITIES)[number];

const GARANTIA_FIELDS = ["cliente", "modelo", "color", "imei", "problema", "estado", "contraparte", "tecnicoId", "motivo"] as const;
const EQUIPO_FIELDS = ["marca", "modelo", "almacenamientoGb", "color", "resultado"] as const;
const EQUIPO_FORBIDDEN = ["imei", "serial", "serialNumber", "serie", "id"] as const;
const LOTE_FIELDS = ["estado", "notas"] as const;
const LOTE_ESTADOS = ["DRAFT", "PENDING_REVIEW", "IN_REVIEW", "CANCELLED"] as const;
const TAREA_FIELDS = ["titulo", "descripcion", "prioridad", "vence", "estado", "comentario"] as const;
const TAREA_ESTADOS = ["PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"] as const;
const TAREA_PRIORIDADES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const FLOW_NEEDS_COUNTERPARTY = new Set<FlowOperation>(["assign", "receive-repaired", "receive-unrepaired", "send-supplier", "receive-supplier"]);
const FLOW_NEEDS_REASON = new Set<FlowOperation>(["receive-supplier"]);

export type FieldDiff = { campo: string; anterior: unknown; nuevo: unknown };
export type ProposalResult = { ok: boolean; errors: string[]; warnings: string[]; cambios: Record<string, unknown> };

export function isWriteEntity(value: string): value is WriteEntity {
  return (WRITE_ENTITIES as readonly string[]).includes(value);
}

export function stableString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableString(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableString(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeVersionHash(snapshot: Record<string, unknown>): string {
  return createHash("sha256").update(stableString(snapshot)).digest("hex").slice(0, 16);
}

export function diffFrom(anterior: Record<string, unknown>, cambios: Record<string, unknown>): FieldDiff[] {
  return Object.keys(cambios).sort().map((campo) => ({ campo, anterior: anterior[campo] ?? null, nuevo: cambios[campo] }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function unknownKeys(propuesta: Record<string, unknown>, allowed: readonly string[], forbidden: readonly string[] = []): string[] {
  return Object.keys(propuesta).filter((key) => !allowed.includes(key) && !forbidden.includes(key));
}

export type WarrantyMove =
  | { kind: "flow"; operation: FlowOperation }
  | { kind: "direct" };

export function warrantyMove(from: WarrantyStatus, to: WarrantyStatus): WarrantyMove | null {
  if (to === "DELIVERED" || to === "CREDIT_NOTE") return null;
  if (!canTransition(from, to)) return null;
  if (to === "IN_REPAIR" && (from === "RECEIVED" || from === "RECEIVED_FROM_SUPPLIER")) return { kind: "flow", operation: "assign" };
  if (to === "RECEIVED_FROM_TECHNICIAN" && (from === "TECHNICIAN_REPORTED_REPAIRED" || from === "IN_REPAIR")) {
    return { kind: "flow", operation: "receive-repaired" };
  }
  if (to === "RECEIVED" && (from === "TECHNICIAN_REPORTED_UNREPAIRED" || from === "IN_REPAIR")) {
    return { kind: "flow", operation: "receive-unrepaired" };
  }
  if (to === "SENT_TO_SUPPLIER" && (from === "RECEIVED" || from === "RECEIVED_FROM_TECHNICIAN")) {
    return { kind: "flow", operation: "send-supplier" };
  }
  if (to === "RECEIVED_FROM_SUPPLIER" && from === "SENT_TO_SUPPLIER") return { kind: "flow", operation: "receive-supplier" };
  if (to === "READY_FOR_CUSTOMER" && (from === "RECEIVED_FROM_TECHNICIAN" || from === "RECEIVED_FROM_SUPPLIER")) {
    return { kind: "flow", operation: "mark-ready" };
  }
  return { kind: "direct" };
}

export function assessGarantia(
  current: { status: WarrantyStatus; archivedAt: string | null; cliente: string; modelo: string; color: string | null; imei: string; problema: string },
  raw: unknown,
): ProposalResult & { move: WarrantyMove | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const propuesta = asRecord(raw);
  if (!propuesta) return { ok: false, errors: ["La propuesta debe ser un objeto."], warnings, cambios: {}, move: null };
  if (current.archivedAt) errors.push("El caso está archivado. Restaurar o archivar no entra en esta versión.");
  for (const key of EQUIPO_FORBIDDEN) {
    if (key in propuesta && key !== "imei") errors.push(`El campo "${key}" no se puede modificar por el MCP.`);
  }
  for (const key of unknownKeys(propuesta, GARANTIA_FIELDS)) warnings.push(`El campo "${key}" se ignora.`);
  if ("archivedAt" in propuesta || propuesta.archivar === true) errors.push("Archivar un caso queda fuera de esta versión.");

  const cambios: Record<string, unknown> = {};
  const take = (key: string, next: unknown, previous: unknown) => {
    if (next !== previous) cambios[key] = next;
  };
  if ("cliente" in propuesta) {
    if (typeof propuesta.cliente !== "string" || propuesta.cliente.trim().length < 1) errors.push("El cliente no es válido.");
    else take("cliente", propuesta.cliente.trim().replace(/\s+/g, " "), current.cliente);
  }
  if ("modelo" in propuesta) {
    if (typeof propuesta.modelo !== "string" || propuesta.modelo.trim().length < 1) errors.push("El modelo no es válido.");
    else take("modelo", propuesta.modelo.trim().replace(/\s+/g, " "), current.modelo);
  }
  if ("color" in propuesta) {
    if (propuesta.color !== null && typeof propuesta.color !== "string") errors.push("El color no es válido.");
    else take("color", typeof propuesta.color === "string" ? propuesta.color.trim() || null : null, current.color);
  }
  if ("imei" in propuesta) {
    const parsed = warrantyIdentifierSchema.safeParse(propuesta.imei);
    if (!parsed.success) errors.push(parsed.error.issues[0]?.message ?? "El identificador no es válido.");
    else take("imei", parsed.data, current.imei);
  }
  if ("problema" in propuesta) {
    if (typeof propuesta.problema !== "string" || propuesta.problema.trim().length < 1) errors.push("El problema no es válido.");
    else take("problema", propuesta.problema.trim(), current.problema);
  }

  let move: WarrantyMove | null = null;
  if ("estado" in propuesta) {
    const estado = propuesta.estado;
    if (estado === "DELIVERED" || estado === "CREDIT_NOTE") {
      errors.push("Entregar al cliente y la nota de crédito quedan fuera de esta versión.");
    } else if (typeof estado !== "string") {
      errors.push("El estado no es válido.");
    } else if (estado !== current.status) {
      move = warrantyMove(current.status, estado as WarrantyStatus);
      if (!move) errors.push(`No se puede pasar de ${current.status} a ${estado}.`);
      else {
        cambios.estado = estado;
        if (move.kind === "flow" && FLOW_NEEDS_COUNTERPARTY.has(move.operation)) {
          const contraparte = typeof propuesta.contraparte === "string" ? propuesta.contraparte.trim() : "";
          const tecnicoId = typeof propuesta.tecnicoId === "string" ? propuesta.tecnicoId.trim() : "";
          if (!contraparte && !tecnicoId) errors.push("Esta transición necesita contraparte o tecnicoId.");
          else {
            if (contraparte) cambios.contraparte = contraparte;
            if (tecnicoId) cambios.tecnicoId = tecnicoId;
          }
        }
        if (move.kind === "flow" && FLOW_NEEDS_REASON.has(move.operation)) {
          const motivo = typeof propuesta.motivo === "string" ? propuesta.motivo.trim() : "";
          if (!motivo) errors.push("Esta transición necesita motivo.");
          else cambios.motivo = motivo;
        } else if (typeof propuesta.motivo === "string" && propuesta.motivo.trim()) {
          cambios.motivo = propuesta.motivo.trim();
        }
      }
    }
  }
  if (Object.keys(cambios).length === 0 && errors.length === 0) errors.push("La propuesta no cambia ningún dato.");
  return { ok: errors.length === 0, errors, warnings, cambios, move };
}

export function assessEquipo(
  current: { marca: string | null; modelo: string; almacenamientoGb: number | null; color: string | null; resultado: string | null },
  raw: unknown,
): ProposalResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const propuesta = asRecord(raw);
  if (!propuesta) return { ok: false, errors: ["La propuesta debe ser un objeto."], warnings, cambios: {} };
  for (const key of EQUIPO_FORBIDDEN) {
    if (key in propuesta) errors.push(`El campo "${key}" es la identidad del equipo y no se modifica por el MCP.`);
  }
  for (const key of unknownKeys(propuesta, EQUIPO_FIELDS, EQUIPO_FORBIDDEN)) warnings.push(`El campo "${key}" se ignora.`);
  const cambios: Record<string, unknown> = {};
  if ("marca" in propuesta) {
    if (propuesta.marca !== null && typeof propuesta.marca !== "string") errors.push("La marca no es válida.");
    else {
      const marca = typeof propuesta.marca === "string" ? propuesta.marca.trim() || null : null;
      if (marca !== current.marca) cambios.marca = marca;
    }
  }
  if ("modelo" in propuesta) {
    if (typeof propuesta.modelo !== "string" || !propuesta.modelo.trim()) errors.push("El modelo es obligatorio.");
    else if (propuesta.modelo.trim() !== current.modelo) cambios.modelo = propuesta.modelo.trim();
  }
  if ("almacenamientoGb" in propuesta) {
    const value = propuesta.almacenamientoGb;
    if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 4096)) {
      errors.push("El almacenamiento debe ser un entero entre 1 y 4096, o null.");
    } else if (value !== current.almacenamientoGb) cambios.almacenamientoGb = value;
  }
  if ("color" in propuesta) {
    if (propuesta.color !== null && typeof propuesta.color !== "string") errors.push("El color no es válido.");
    else {
      const color = typeof propuesta.color === "string" ? propuesta.color.trim() || null : null;
      if (color !== current.color) cambios.color = color;
    }
  }
  if ("resultado" in propuesta) {
    if (propuesta.resultado !== "FUNCTIONAL" && propuesta.resultado !== "NON_FUNCTIONAL" && propuesta.resultado !== "UNSPECIFIED") {
      errors.push("El resultado debe ser FUNCTIONAL, NON_FUNCTIONAL o UNSPECIFIED.");
    } else if (propuesta.resultado !== current.resultado) cambios.resultado = propuesta.resultado;
  }
  if (Object.keys(cambios).length === 0 && errors.length === 0) errors.push("La propuesta no cambia ningún dato.");
  return { ok: errors.length === 0, errors, warnings, cambios };
}

export function assessLote(current: { estado: string; notas: string | null }, raw: unknown): ProposalResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const propuesta = asRecord(raw);
  if (!propuesta) return { ok: false, errors: ["La propuesta debe ser un objeto."], warnings, cambios: {} };
  if ("COMPLETED" === propuesta.estado || "SUBMITTED" === propuesta.estado) {
    errors.push("Completar o enviar un lote a pago queda fuera de esta versión.");
  }
  for (const key of unknownKeys(propuesta, LOTE_FIELDS)) warnings.push(`El campo "${key}" se ignora.`);
  const cambios: Record<string, unknown> = {};
  if ("estado" in propuesta && propuesta.estado !== current.estado) {
    if (typeof propuesta.estado !== "string" || !(LOTE_ESTADOS as readonly string[]).includes(propuesta.estado)) {
      if (propuesta.estado !== "COMPLETED" && propuesta.estado !== "SUBMITTED") errors.push("Estado de lote no permitido.");
    } else cambios.estado = propuesta.estado;
  }
  if ("notas" in propuesta) {
    if (propuesta.notas !== null && typeof propuesta.notas !== "string") errors.push("Las notas no son válidas.");
    else {
      const notas = typeof propuesta.notas === "string" ? propuesta.notas.trim() || null : null;
      if (notas !== current.notas) cambios.notas = notas;
    }
  }
  if (Object.keys(cambios).length === 0 && errors.length === 0) errors.push("La propuesta no cambia ningún dato.");
  return { ok: errors.length === 0, errors, warnings, cambios };
}

export function assessTarea(
  current: { titulo: string; descripcion: string | null; prioridad: string; vence: string | null; estado: string; kind: string },
  raw: unknown,
): ProposalResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const propuesta = asRecord(raw);
  if (!propuesta) return { ok: false, errors: ["La propuesta debe ser un objeto."], warnings, cambios: {} };
  for (const key of unknownKeys(propuesta, TAREA_FIELDS)) warnings.push(`El campo "${key}" se ignora.`);
  const content = ["titulo", "descripcion", "prioridad", "vence"].some((key) => key in propuesta);
  if (current.kind === "AUTOMATIC" && content) errors.push("Las tareas automáticas solo admiten estado y comentario.");
  const cambios: Record<string, unknown> = {};
  if ("titulo" in propuesta) {
    if (typeof propuesta.titulo !== "string" || propuesta.titulo.trim().length < 3) errors.push("El título debe tener al menos 3 caracteres.");
    else if (propuesta.titulo.trim() !== current.titulo) cambios.titulo = propuesta.titulo.trim();
  }
  if ("descripcion" in propuesta) {
    if (propuesta.descripcion !== null && typeof propuesta.descripcion !== "string") errors.push("La descripción no es válida.");
    else {
      const descripcion = typeof propuesta.descripcion === "string" ? propuesta.descripcion.trim() || null : null;
      if (descripcion !== current.descripcion) cambios.descripcion = descripcion;
    }
  }
  if ("prioridad" in propuesta && propuesta.prioridad !== current.prioridad) {
    if (typeof propuesta.prioridad !== "string" || !(TAREA_PRIORIDADES as readonly string[]).includes(propuesta.prioridad)) errors.push("Prioridad no válida.");
    else cambios.prioridad = propuesta.prioridad;
  }
  if ("vence" in propuesta) {
    if (propuesta.vence !== null && (typeof propuesta.vence !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(propuesta.vence))) {
      errors.push("El vencimiento debe ser una fecha YYYY-MM-DD o null.");
    } else {
      const vence = typeof propuesta.vence === "string" ? propuesta.vence.slice(0, 10) : null;
      if (vence !== current.vence) cambios.vence = vence;
    }
  }
  if ("estado" in propuesta && propuesta.estado !== current.estado) {
    if (typeof propuesta.estado !== "string" || !(TAREA_ESTADOS as readonly string[]).includes(propuesta.estado)) errors.push("Estado de tarea no válido.");
    else cambios.estado = propuesta.estado;
  }
  if ("comentario" in propuesta) {
    if (typeof propuesta.comentario !== "string" || propuesta.comentario.trim().length < 1) errors.push("El comentario no es válido.");
    else cambios.comentario = propuesta.comentario.trim();
  }
  if (Object.keys(cambios).length === 0 && errors.length === 0) errors.push("La propuesta no cambia ningún dato.");
  return { ok: errors.length === 0, errors, warnings, cambios };
}

export function sameChanges(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return stableString(left) === stableString(right);
}
