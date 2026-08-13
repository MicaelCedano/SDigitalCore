"use server";

import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import {
  archiveWarrantySchema,
  createWarrantySchema,
  flowSchema,
  restoreWarrantySchema,
  updateWarrantySchema,
} from "@/lib/validation/warranty";
import { civilDate, nextWarrantyNumber, santoDomingoDateString } from "@/modules/garantias/lib/document-number";
import { Prisma, WarrantyDocumentType, WarrantyEventType, WarrantyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string; fieldErrors?: Record<string, string[]> };
type ArchiveFilter = "active" | "archived" | "all";
type FlowOperation = "assign" | "receive-repaired" | "receive-unrepaired" | "send-supplier" | "receive-supplier" | "deliver" | "credit";

export type WarrantyCaseListItem = {
  id: string;
  caseCode: string;
  imei: string;
  model: string;
  clientName: string;
  problem: string;
  status: WarrantyStatus;
  entryDate: Date;
  archivedAt: Date | null;
  _count: { events: number; documentItems: number };
};

export type WarrantyDocumentData = {
  id: string;
  documentCode: string;
  type: WarrantyDocumentType;
  counterpartyName: string;
  documentDate: Date;
  notes: string | null;
  createdAt: Date;
  createdBy: { name: string | null } | null;
  items: Array<{
    id: string;
    sortOrder: number;
    case: { caseCode: string; imei: string; model: string; color: string | null; clientName: string; problem: string };
  }>;
};

class WarrantyActionError extends Error {}

const ok = <T>(data: T): Result<T> => ({ success: true, data });

function fail(error: unknown): Result<never> {
  if (error instanceof WarrantyActionError) return { success: false, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false, error: "Ya existe un caso abierto con uno de esos IMEIs. Actualiza el panel y revisa el registro existente." };
  }
  console.error("[garantias] Error en operación", error);
  return { success: false, error: "No se pudo completar la operación. Inténtalo nuevamente." };
}

function auditData(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeName(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function comparableName(value: string | undefined | null) {
  return normalizeName(value ?? undefined).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function revalidateWarranty(caseCodes: string[], documentCode?: string | null) {
  revalidatePath("/garantias");
  revalidatePath("/garantias/historial/documentos");
  for (const caseCode of caseCodes) revalidatePath(`/garantias/${caseCode}`);
  if (documentCode) revalidatePath(`/garantias/documentos/${documentCode}`);
}

const documentSelect = {
  id: true,
  documentCode: true,
  type: true,
  counterpartyName: true,
  documentDate: true,
  notes: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      sortOrder: true,
      case: { select: { caseCode: true, imei: true, model: true, color: true, clientName: true, problem: true } },
    },
  },
} satisfies Prisma.WarrantyDocumentSelect;

const documentPrefix: Record<WarrantyDocumentType, string> = {
  INTAKE_RECEIPT: "REC",
  TECHNICIAN_ASSIGNMENT: "TECN",
  TECHNICIAN_RECEIPT_REPAIRED: "TECN",
  TECHNICIAN_RECEIPT_UNREPAIRED: "TECN",
  SUPPLIER_SHIPMENT: "SUPL",
  SUPPLIER_RECEIPT: "SUPL",
  CUSTOMER_DELIVERY: "COND",
  CREDIT_NOTE: "NC",
};

export async function createDocument(
  tx: Prisma.TransactionClient,
  actorId: string,
  type: WarrantyDocumentType,
  counterpartyName: string,
  caseIds: string[],
  notes?: string,
) {
  const prefix = documentPrefix[type];
  const code = await nextWarrantyNumber(tx, new Date(), prefix, prefix);
  return tx.warrantyDocument.create({
    data: {
      documentCode: code,
      type,
      counterpartyName,
      documentDate: civilDate(new Date()),
      createdById: actorId,
      notes: notes || undefined,
      items: { create: caseIds.map((caseId, sortOrder) => ({ caseId, sortOrder })) },
    },
    select: { id: true, documentCode: true },
  });
}

export async function createEvent(
  tx: Prisma.TransactionClient,
  caseId: string,
  actor: { id: string; name?: string | null },
  type: WarrantyEventType,
  extra: {
    fromStatus?: WarrantyStatus;
    toStatus?: WarrantyStatus;
    counterpartyName?: string;
    reason?: string;
    beforeData?: unknown;
    afterData?: unknown;
  } = {},
) {
  return tx.warrantyEvent.create({
    data: {
      caseId,
      type,
      actorId: actor.id,
      actorNameSnapshot: actor.name ?? actor.id,
      fromStatus: extra.fromStatus,
      toStatus: extra.toStatus,
      counterpartyName: extra.counterpartyName,
      reason: extra.reason,
      beforeData: extra.beforeData ? auditData(extra.beforeData) : undefined,
      afterData: extra.afterData ? auditData(extra.afterData) : undefined,
    },
  });
}

export async function listWarrantyCases(input?: {
  search?: string;
  status?: WarrantyStatus | "ALL";
  page?: number;
  pageSize?: number;
  olderThan30?: boolean;
  archive?: ArchiveFilter;
}): Promise<Result<{ cases: WarrantyCaseListItem[]; total: number; page: number; pageSize: number }>> {
  try {
    await requirePermission("warranties.read");
    const page = Number.isInteger(input?.page) ? Math.max(1, input?.page ?? 1) : 1;
    const pageSize = Number.isInteger(input?.pageSize) ? Math.min(100, Math.max(10, input?.pageSize ?? 25)) : 25;
    const search = input?.search?.trim().slice(0, 160);
    const searchDigits = search?.replace(/\D/g, "");
    const validStatuses = new Set(Object.values(WarrantyStatus));
    const status = input?.status && input.status !== "ALL" && validStatuses.has(input.status) ? input.status : undefined;
    const archive = input?.archive === "archived" || input?.archive === "all" ? input.archive : "active";
    const cutoff = civilDate(santoDomingoDateString(new Date(Date.now() - 30 * 86_400_000)));
    const where: Prisma.WarrantyCaseWhereInput = {
      ...(archive === "active" ? { archivedAt: null } : archive === "archived" ? { archivedAt: { not: null } } : {}),
      ...(status ? { status } : {}),
      ...(input?.olderThan30
        ? { status: { notIn: ["DELIVERED", "CREDIT_NOTE"] }, entryDate: { lte: cutoff } }
        : {}),
      ...(search
        ? {
            OR: [
              { caseCode: { contains: search, mode: "insensitive" } },
              { imei: { contains: search } },
              ...(searchDigits && searchDigits.length >= 4 ? [{ imei: { endsWith: searchDigits } } as const] : []),
              { model: { contains: search, mode: "insensitive" } },
              { clientName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [cases, total] = await Promise.all([
      prisma.warrantyCase.findMany({
        where,
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          caseCode: true,
          imei: true,
          model: true,
          clientName: true,
          problem: true,
          status: true,
          entryDate: true,
          archivedAt: true,
          _count: { select: { events: true, documentItems: true } },
        },
      }),
      prisma.warrantyCase.count({ where }),
    ]);
    return ok({ cases, total, page, pageSize });
  } catch (error) {
    return fail(error);
  }
}

export async function getWarrantyDashboardStats(): Promise<Result<Record<string, number>>> {
  try {
    await requirePermission("warranties.read");
    const cutoff = civilDate(santoDomingoDateString(new Date(Date.now() - 30 * 86_400_000)));
    const [groups, open30, active] = await Promise.all([
      prisma.warrantyCase.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }),
      prisma.warrantyCase.count({ where: { archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] }, entryDate: { lte: cutoff } } }),
      prisma.warrantyCase.count({ where: { archivedAt: null } }),
    ]);
    return ok(Object.fromEntries([...groups.map((group) => [group.status, group._count._all]), ["OPEN_30_PLUS", open30], ["ACTIVE_TOTAL", active]]));
  } catch (error) {
    return fail(error);
  }
}

export async function getWarrantyCase(caseCode: string): Promise<Result<unknown>> {
  try {
    await requirePermission("warranties.read");
    const item = await prisma.warrantyCase.findUnique({
      where: { caseCode: caseCode.trim() },
      select: {
        caseCode: true,
        imei: true,
        model: true,
        clientName: true,
        problem: true,
        status: true,
        entryDate: true,
        assignedTechnicianName: true,
        currentSupplierName: true,
        archivedAt: true,
        createdAt: true,
        events: {
          orderBy: { createdAt: "asc" },
          select: { id: true, type: true, fromStatus: true, toStatus: true, actorNameSnapshot: true, counterpartyName: true, reason: true, createdAt: true },
        },
        documentItems: {
          orderBy: { document: { documentDate: "desc" } },
          select: { document: { select: { id: true, documentCode: true, type: true, documentDate: true } } },
        },
      },
    });
    return item ? ok(item) : { success: false, error: "Caso no encontrado." };
  } catch (error) {
    return fail(error);
  }
}

export async function createWarrantyCases(input: unknown): Promise<Result<{ caseCodes: string[]; documentCode: string }>> {
  try {
    const actor = await requirePermission("warranties.create");
    const parsed = createWarrantySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Revisa los datos del ingreso.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }
    const result = await prisma.$transaction(async (tx) => {
      const incomingImeis = parsed.data.devices.map((device) => device.imei);
      const existing = await tx.warrantyCase.findMany({
        where: { imei: { in: incomingImeis }, archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] } },
        select: { imei: true, caseCode: true },
      });
      if (existing.length > 0) {
        throw new WarrantyActionError(`Ya hay casos abiertos para: ${existing.map((item) => `${item.imei} (${item.caseCode})`).join(", ")}.`);
      }

      const created = [];
      for (const device of parsed.data.devices) {
        const code = await nextWarrantyNumber(tx, new Date(), "CASE", "GAR");
        const item = await tx.warrantyCase.create({
          data: {
            caseCode: code,
            imei: device.imei,
            model: normalizeName(device.model),
            color: device.color ? normalizeName(device.color) : null,
            clientName: normalizeName(parsed.data.clientName),
            problem: device.problem.trim(),
            entryDate: civilDate(parsed.data.entryDate),
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
        await createEvent(tx, item.id, actor, "CREATED", { toStatus: "RECEIVED", afterData: { caseCode: code, imei: item.imei } });
        created.push(item);
      }
      const document = await createDocument(tx, actor.id, "INTAKE_RECEIPT", normalizeName(parsed.data.clientName), created.map((item) => item.id));
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "warranty.create_batch",
          module: "garantias",
          entityType: "WarrantyDocument",
          entityId: document.id,
          afterData: auditData({ caseCodes: created.map((item) => item.caseCode), clientName: parsed.data.clientName, documentCode: document.documentCode }),
        },
      });
      return { caseCodes: created.map((item) => item.caseCode), documentCode: document.documentCode };
    });
    revalidateWarranty(result.caseCodes, result.documentCode);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function updateWarrantyCaseDetails(input: unknown): Promise<Result<{ caseCode: string }>> {
  try {
    const actor = await requirePermission("warranties.update");
    const parsed = updateWarrantySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Revisa los datos del caso." };
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.warrantyCase.findUnique({ where: { caseCode: parsed.data.caseCode } });
      if (!current || current.archivedAt) throw new WarrantyActionError("Caso no encontrado o archivado.");
      if (current.imei !== parsed.data.imei) {
        const duplicate = await tx.warrantyCase.findFirst({
          where: { id: { not: current.id }, imei: parsed.data.imei, archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] } },
          select: { caseCode: true },
        });
        if (duplicate) throw new WarrantyActionError(`Ese IMEI ya está abierto en ${duplicate.caseCode}.`);
      }
      const updated = await tx.warrantyCase.update({
        where: { id: current.id },
        data: {
          clientName: normalizeName(parsed.data.clientName),
          model: normalizeName(parsed.data.model),
          imei: parsed.data.imei,
          problem: parsed.data.problem.trim(),
          updatedById: actor.id,
        },
      });
      await createEvent(tx, current.id, actor, "DETAILS_UPDATED", { beforeData: current, afterData: updated });
      await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.details.update", module: "garantias", entityType: "WarrantyCase", entityId: current.id, beforeData: auditData(current), afterData: auditData(updated) } });
      return { caseCode: updated.caseCode };
    });
    revalidateWarranty([result.caseCode]);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

const flowRules: Record<FlowOperation, {
  toStatus: WarrantyStatus;
  allowed: WarrantyStatus[];
  documentType: WarrantyDocumentType;
  eventType: WarrantyEventType;
  needsCounterparty: boolean;
  needsReason: boolean;
}> = {
  assign: { toStatus: "IN_REPAIR", allowed: ["RECEIVED", "RECEIVED_FROM_SUPPLIER"], documentType: "TECHNICIAN_ASSIGNMENT", eventType: "ASSIGNED_TO_TECHNICIAN", needsCounterparty: true, needsReason: false },
  "receive-repaired": { toStatus: "RECEIVED_FROM_TECHNICIAN", allowed: ["IN_REPAIR"], documentType: "TECHNICIAN_RECEIPT_REPAIRED", eventType: "RECEIVED_REPAIRED", needsCounterparty: true, needsReason: true },
  "receive-unrepaired": { toStatus: "RECEIVED", allowed: ["IN_REPAIR"], documentType: "TECHNICIAN_RECEIPT_UNREPAIRED", eventType: "RECEIVED_UNREPAIRED", needsCounterparty: true, needsReason: false },
  "send-supplier": { toStatus: "SENT_TO_SUPPLIER", allowed: ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN"], documentType: "SUPPLIER_SHIPMENT", eventType: "SENT_TO_SUPPLIER", needsCounterparty: true, needsReason: false },
  "receive-supplier": { toStatus: "RECEIVED_FROM_SUPPLIER", allowed: ["SENT_TO_SUPPLIER"], documentType: "SUPPLIER_RECEIPT", eventType: "RECEIVED_FROM_SUPPLIER", needsCounterparty: true, needsReason: true },
  deliver: { toStatus: "DELIVERED", allowed: ["RECEIVED", "RECEIVED_FROM_TECHNICIAN", "RECEIVED_FROM_SUPPLIER"], documentType: "CUSTOMER_DELIVERY", eventType: "DELIVERED_TO_CUSTOMER", needsCounterparty: true, needsReason: true },
  credit: { toStatus: "CREDIT_NOTE", allowed: ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN", "SENT_TO_SUPPLIER", "RECEIVED_FROM_SUPPLIER"], documentType: "CREDIT_NOTE", eventType: "CREDIT_NOTE_MARKED", needsCounterparty: false, needsReason: true },
};

async function flow(input: unknown, operation: FlowOperation): Promise<Result<{ documentCode: string; status: WarrantyStatus }>> {
  try {
    const actor = await requirePermission("warranties.transition");
    const parsed = flowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Revisa los datos del flujo." };
    const data = parsed.data;
    const rule = flowRules[operation];
    let counterpartyName = normalizeName(data.counterpartyName);
    const reason = data.reason?.trim();
    const caseObservations = data.caseObservations ?? {};

    if (operation === "receive-unrepaired") {
      const missingObservation = data.caseCodes.find((caseCode) => !caseObservations[caseCode]?.trim());
      if (missingObservation) return { success: false, error: `La observación del caso ${missingObservation} es obligatoria.` };
    }

    // "Enviar a Reparaciones": si viene technicianId real, resolver el usuario y
    // usar su nombre como contraparte (assignedTechnicianName snapshot) + enlazar ID.
    let technicianId: string | null = null;
    if (data.technicianId) {
      const technician = await prisma.user.findFirst({
        where: { id: data.technicianId, status: "ACTIVE" },
        select: { id: true, name: true, username: true },
      });
      if (!technician) return { success: false, error: "El técnico indicado no existe o no está activo." };
      technicianId = technician.id;
      counterpartyName = normalizeName(counterpartyName || technician.name || technician.username || "");
    } else if (operation === "assign" && counterpartyName) {
      const technician = await prisma.user.findFirst({
        where: {
          status: "ACTIVE",
          roleCode: "TECNICO",
          allowedModules: { has: "reparaciones" },
          OR: [
            { username: { equals: counterpartyName, mode: "insensitive" } },
            { name: { equals: counterpartyName, mode: "insensitive" } },
            { name: { contains: counterpartyName, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, username: true },
      });
      if (!technician) return { success: false, error: "Selecciona un técnico activo con acceso a Reparaciones." };
      technicianId = technician.id;
      counterpartyName = normalizeName(technician.name || technician.username || counterpartyName);
    }

    if (rule.needsCounterparty && !counterpartyName) return { success: false, error: "La contraparte es obligatoria." };
    if (rule.needsReason && !reason) return { success: false, error: "La resolución u observación es obligatoria." };

    const result = await prisma.$transaction(async (tx) => {
      const cases = await tx.warrantyCase.findMany({ where: { caseCode: { in: data.caseCodes }, archivedAt: null } });
      if (cases.length !== data.caseCodes.length) throw new WarrantyActionError("Uno o más casos no existen o están archivados.");
      if (cases.some((item) => !rule.allowed.includes(item.status))) throw new WarrantyActionError("Uno o más casos cambiaron de estado y ya no son elegibles.");
      if (operation === "deliver" && cases.some((item) => comparableName(item.clientName) !== comparableName(counterpartyName))) {
        throw new WarrantyActionError("Para entregar, todos los casos deben pertenecer al cliente indicado.");
      }
      // La recepción desde técnico no compara el nombre: puede existir una diferencia de escritura histórica.
      if (false && operation.startsWith("receive-") && operation !== "receive-supplier" && cases.some((item) => comparableName(item.assignedTechnicianName) !== comparableName(counterpartyName))) {
        throw new WarrantyActionError("El técnico indicado no coincide con el técnico asignado en uno o más casos.");
      }
      if (operation === "receive-supplier" && cases.some((item) => comparableName(item.currentSupplierName) !== comparableName(counterpartyName))) {
        throw new WarrantyActionError("El suplidor indicado no coincide con el envío registrado en uno o más casos.");
      }

      for (const item of cases) {
        const update = await tx.warrantyCase.updateMany({
          where: { id: item.id, status: item.status, archivedAt: null },
          data: {
            status: rule.toStatus,
            updatedById: actor.id,
            ...(operation === "assign" ? { assignedTechnicianName: counterpartyName, assignedTechnicianId: technicianId ?? undefined, currentSupplierName: null } : {}),
            ...(operation === "receive-repaired" || operation === "receive-unrepaired" ? { assignedTechnicianId: null, assignedTechnicianName: null } : {}),
            ...(operation === "send-supplier" ? { currentSupplierName: counterpartyName, assignedTechnicianId: null, assignedTechnicianName: null } : {}),
            ...(operation === "receive-supplier" ? { currentSupplierName: null } : {}),
            ...(operation === "deliver" || operation === "credit" ? { assignedTechnicianId: null, assignedTechnicianName: null, currentSupplierName: null } : {}),
          },
        });
        if (update.count !== 1) throw new WarrantyActionError(`El caso ${item.caseCode} fue actualizado por otra persona. Recarga e inténtalo nuevamente.`);
        const itemReason = operation === "receive-unrepaired" ? caseObservations[item.caseCode]?.trim() : reason;
        await createEvent(tx, item.id, actor, rule.eventType, { fromStatus: item.status, toStatus: rule.toStatus, counterpartyName: counterpartyName || item.clientName, reason: itemReason });
      }
      const document = await createDocument(tx, actor.id, rule.documentType, counterpartyName || cases[0].clientName, cases.map((item) => item.id), reason);
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: `warranty.${operation}`,
          module: "garantias",
          entityType: "WarrantyDocument",
          entityId: document.id,
          afterData: auditData({ caseCodes: data.caseCodes, toStatus: rule.toStatus, counterpartyName, reason, documentCode: document.documentCode }),
        },
      });
      return { documentCode: document.documentCode, status: rule.toStatus };
    });
    revalidateWarranty(data.caseCodes, result.documentCode);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function assignCasesToTechnician(input: unknown) { return flow(input, "assign"); }
export async function receiveCasesFromTechnician(input: unknown, repaired: boolean) { return flow(input, repaired ? "receive-repaired" : "receive-unrepaired"); }
export async function sendCasesToSupplier(input: unknown) { return flow(input, "send-supplier"); }
export async function receiveCasesFromSupplier(input: unknown) { return flow(input, "receive-supplier"); }
export async function deliverCasesToCustomer(input: unknown) { return flow(input, "deliver"); }
export async function markWarrantyCreditNote(input: unknown) { return flow(input, "credit"); }

export async function listWarrantyDocuments(): Promise<Result<WarrantyDocumentData[]>> {
  try {
    await requirePermission("warranties.documents");
    return ok(await prisma.warrantyDocument.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: documentSelect }));
  } catch (error) {
    return fail(error);
  }
}

export async function getWarrantyDocument(documentCode: string): Promise<Result<WarrantyDocumentData>> {
  try {
    await requirePermission("warranties.documents");
    const document = await prisma.warrantyDocument.findUnique({ where: { documentCode: documentCode.trim() }, select: documentSelect });
    return document ? ok(document) : { success: false, error: "Documento no encontrado." };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveWarrantyCase(caseCode: string, reason: string): Promise<Result<{ caseCode: string }>> {
  try {
    const actor = await requirePermission("warranties.archive");
    const parsed = archiveWarrantySchema.safeParse({ caseCode, reason });
    if (!parsed.success) return { success: false, error: "Indica un motivo válido para archivar." };
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.warrantyCase.findUnique({ where: { caseCode: parsed.data.caseCode } });
      if (!current) throw new WarrantyActionError("Caso no encontrado.");
      if (current.archivedAt) throw new WarrantyActionError("El caso ya está archivado.");
      const archived = await tx.warrantyCase.update({ where: { id: current.id }, data: { archivedAt: new Date(), archivedById: actor.id, updatedById: actor.id } });
      await createEvent(tx, current.id, actor, "ARCHIVED", { reason: parsed.data.reason });
      await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.archive", module: "garantias", entityType: "WarrantyCase", entityId: current.id, beforeData: auditData(current), afterData: auditData({ archivedAt: archived.archivedAt, reason: parsed.data.reason }) } });
      return { caseCode: current.caseCode };
    });
    revalidateWarranty([result.caseCode]);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function restoreWarrantyCase(caseCode: string, reason?: string): Promise<Result<{ caseCode: string }>> {
  try {
    const actor = await requirePermission("warranties.archive");
    const parsed = restoreWarrantySchema.safeParse({ caseCode, reason });
    if (!parsed.success) return { success: false, error: "Los datos para restaurar no son válidos." };
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.warrantyCase.findUnique({ where: { caseCode: parsed.data.caseCode } });
      if (!current) throw new WarrantyActionError("Caso no encontrado.");
      if (!current.archivedAt) throw new WarrantyActionError("El caso no está archivado.");
      if (!["DELIVERED", "CREDIT_NOTE"].includes(current.status)) {
        const duplicate = await tx.warrantyCase.findFirst({
          where: { id: { not: current.id }, imei: current.imei, archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] } },
          select: { caseCode: true },
        });
        if (duplicate) throw new WarrantyActionError(`No se puede restaurar: el IMEI ya está abierto en ${duplicate.caseCode}.`);
      }
      await tx.warrantyCase.update({ where: { id: current.id }, data: { archivedAt: null, archivedById: null, updatedById: actor.id } });
      await createEvent(tx, current.id, actor, "RESTORED", { reason: parsed.data.reason || "Restaurado al panel operativo." });
      await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.restore", module: "garantias", entityType: "WarrantyCase", entityId: current.id, beforeData: auditData(current), afterData: auditData({ archivedAt: null, reason: parsed.data.reason }) } });
      return { caseCode: current.caseCode };
    });
    revalidateWarranty([result.caseCode]);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export type ImeiLookupContext = {
  found: boolean;
  clientName?: string;
  model?: string;
  source?: "invoice" | "warranty" | "receipt";
  caseCode?: string;
};

export async function lookupImeiContext(imeiInput: string): Promise<Result<ImeiLookupContext>> {
  try {
    await requirePermission("warranties.read");
    const digits = imeiInput.trim().replace(/\D/g, "");
    if (!digits || digits.length < 4) {
      return ok({ found: false });
    }

    const invoiceItem = await prisma.invoiceItem.findFirst({
      where: { imeis: { contains: digits } },
      select: {
        description: true,
        invoice: { select: { clientName: true, createdAt: true } },
      },
      orderBy: { invoice: { createdAt: "desc" } },
    });

    if (invoiceItem && invoiceItem.invoice.clientName) {
      return ok({
        found: true,
        clientName: invoiceItem.invoice.clientName,
        model: invoiceItem.description,
        source: "invoice",
      });
    }

    const warrantyCase = await prisma.warrantyCase.findFirst({
      where: { imei: { contains: digits } },
      select: { clientName: true, model: true, caseCode: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    if (warrantyCase && warrantyCase.clientName) {
      return ok({
        found: true,
        clientName: warrantyCase.clientName,
        model: warrantyCase.model,
        source: "warranty",
        caseCode: warrantyCase.caseCode,
      });
    }

    const receiptItem = await prisma.goodsReceiptItem.findFirst({
      where: { imeiOrSerial: { contains: digits } },
      select: { description: true, receipt: { select: { supplierName: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (receiptItem && receiptItem.description) {
      return ok({
        found: true,
        model: receiptItem.description,
        source: "receipt",
      });
    }

    return ok({ found: false });
  } catch (error) {
    return fail(error);
  }
}

export async function getWarrantyModelColors(modelInput: string): Promise<Result<string[]>> {
  try {
    await requirePermission("warranties.read");
    const model = normalizeName(modelInput);
    if (model.length < 2) return ok([]);

    const [receiptItems, warehouseProducts] = await Promise.all([
      prisma.goodsReceiptItem.findMany({
        where: { description: { contains: model, mode: "insensitive" } },
        select: { colorVariants: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.warehouseProduct.findMany({
        where: { name: { contains: model, mode: "insensitive" } },
        select: { color: true },
        take: 50,
      }),
    ]);

    const colors = new Map<string, string>();
    const add = (value: unknown) => {
      if (typeof value !== "string") return;
      const clean = normalizeName(value);
      if (!clean || comparableName(clean) === "general") return;
      colors.set(comparableName(clean), clean);
    };

    for (const item of receiptItems) {
      if (!Array.isArray(item.colorVariants)) continue;
      for (const variant of item.colorVariants) {
        if (variant && typeof variant === "object" && "color" in variant) add(variant.color);
      }
    }
    warehouseProducts.forEach((product) => add(product.color));
    return ok([...colors.values()].sort((a, b) => a.localeCompare(b, "es")));
  } catch (error) {
    return fail(error);
  }
}
