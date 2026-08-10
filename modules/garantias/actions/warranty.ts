"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { createWarrantySchema, caseCodesSchema, flowSchema, updateWarrantySchema } from "@/lib/validation/warranty";
import { canTransition } from "@/modules/garantias/lib/status-machine";
import { civilDate, nextWarrantyNumber } from "@/modules/garantias/lib/document-number";
import { Prisma, WarrantyDocumentType, WarrantyEventType, WarrantyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string; fieldErrors?: Record<string, string[]> };
const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = (error: unknown): Result<never> => ({ success: false, error: error instanceof Error ? error.message : "No se pudo completar la operación." });

function auditData(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

async function createDocument(tx: Prisma.TransactionClient, actorId: string, type: WarrantyDocumentType, counterpartyName: string, caseIds: string[], notes?: string) {
  const prefix = type === "TECHNICIAN_ASSIGNMENT" || type === "TECHNICIAN_RECEIPT_REPAIRED" || type === "TECHNICIAN_RECEIPT_UNREPAIRED" ? "TECN" : type === "SUPPLIER_SHIPMENT" || type === "SUPPLIER_RECEIPT" ? "SUPL" : "COND";
  const sequenceType = prefix === "COND" ? "COND" : prefix;
  const code = await nextWarrantyNumber(tx, new Date(), sequenceType, prefix);
  return tx.warrantyDocument.create({ data: { documentCode: code, type, counterpartyName, documentDate: civilDate(new Date()), createdById: actorId, notes, items: { create: caseIds.map((caseId, sortOrder) => ({ caseId, sortOrder })) } }, include: { items: true } });
}

async function createEvent(tx: Prisma.TransactionClient, caseId: string, actor: { id: string; name?: string | null }, type: WarrantyEventType, extra: { fromStatus?: WarrantyStatus; toStatus?: WarrantyStatus; counterpartyName?: string; reason?: string; beforeData?: unknown; afterData?: unknown } = {}) {
  return tx.warrantyEvent.create({ data: { caseId, type, actorId: actor.id, actorNameSnapshot: actor.name ?? actor.id, fromStatus: extra.fromStatus, toStatus: extra.toStatus, counterpartyName: extra.counterpartyName, reason: extra.reason, beforeData: extra.beforeData ? auditData(extra.beforeData) : undefined, afterData: extra.afterData ? auditData(extra.afterData) : undefined } });
}

export async function listWarrantyCases(input?: { search?: string; status?: WarrantyStatus | "ALL"; page?: number; pageSize?: number; olderThan30?: boolean }): Promise<Result<{ cases: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>> {
  try {
    await requirePermission("warranties.read");
    const page = Math.max(1, input?.page ?? 1); const pageSize = Math.min(100, Math.max(10, input?.pageSize ?? 25));
    const search = input?.search?.trim();
    const where: Prisma.WarrantyCaseWhereInput = { archivedAt: null, ...(input?.status && input.status !== "ALL" ? { status: input.status } : {}), ...(search ? { OR: [{ caseCode: { contains: search, mode: "insensitive" } }, { imei: { contains: search } }, { model: { contains: search, mode: "insensitive" } }, { clientName: { contains: search, mode: "insensitive" } }] } : {}) };
    const cases = await prisma.warrantyCase.findMany({ where, orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { events: true, documentItems: true } } } });
    const total = await prisma.warrantyCase.count({ where });
    const filtered = input?.olderThan30 ? cases.filter((item) => item.status !== "DELIVERED" && item.status !== "CREDIT_NOTE" && Math.floor((Date.now() - item.entryDate.getTime()) / 86400000) >= 30) : cases;
    return ok({ cases: filtered, total, page, pageSize });
  } catch (error) { return fail(error); }
}

export async function getWarrantyDashboardStats(): Promise<Result<Record<string, number>>> {
  try { await requirePermission("warranties.read"); const [groups, open30] = await Promise.all([prisma.warrantyCase.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }), prisma.warrantyCase.count({ where: { archivedAt: null, status: { notIn: ["DELIVERED", "CREDIT_NOTE"] }, entryDate: { lte: new Date(Date.now() - 30 * 86400000) } } })]); return ok(Object.fromEntries([...groups.map((g) => [g.status, g._count._all]), ["OPEN_30_PLUS", open30]])); } catch (error) { return fail(error); }
}

export async function getWarrantyCase(caseCode: string): Promise<Result<unknown>> {
  try { await requirePermission("warranties.read"); const item = await prisma.warrantyCase.findUnique({ where: { caseCode }, include: { events: { orderBy: { createdAt: "asc" } }, documentItems: { include: { document: true }, orderBy: { document: { documentDate: "desc" } } } } }); return item ? ok(item) : fail("Caso no encontrado."); } catch (error) { return fail(error); }
}

export async function createWarrantyCases(input: unknown): Promise<Result<{ caseCodes: string[]; documentCode: string }>> {
  try {
    const actor = await requirePermission("warranties.create"); const parsed = createWarrantySchema.safeParse(input); if (!parsed.success) return { success: false, error: "Revisa los datos del ingreso.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const device of parsed.data.devices) {
        const code = await nextWarrantyNumber(tx, new Date(), "CASE", "GAR");
        const item = await tx.warrantyCase.create({ data: { caseCode: code, imei: device.imei, model: device.model, clientName: parsed.data.clientName, problem: device.problem, entryDate: civilDate(parsed.data.entryDate), createdById: actor.id, updatedById: actor.id } });
        await createEvent(tx, item.id, actor, "CREATED", { toStatus: "RECEIVED", afterData: { caseCode: code, imei: item.imei } }); created.push(item);
      }
      const document = await createDocument(tx, actor.id, "INTAKE_RECEIPT", parsed.data.clientName, created.map((item) => item.id));
      await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.create_batch", module: "garantias", entityType: "WarrantyDocument", entityId: document.id, afterData: auditData({ caseCodes: created.map((item) => item.caseCode), clientName: parsed.data.clientName }) } });
      return { caseCodes: created.map((item) => item.caseCode), documentCode: document.documentCode };
    });
    revalidatePath("/garantias"); return ok(result);
  } catch (error) { return fail(error); }
}

export async function updateWarrantyCaseDetails(input: unknown): Promise<Result<unknown>> {
  try { const actor = await requirePermission("warranties.update"); const parsed = updateWarrantySchema.safeParse(input); if (!parsed.success) return fail("Datos de caso inválidos."); const result = await prisma.$transaction(async (tx) => { const current = await tx.warrantyCase.findUnique({ where: { caseCode: parsed.data.caseCode } }); if (!current || current.archivedAt) throw new Error("Caso no encontrado."); const updated = await tx.warrantyCase.update({ where: { id: current.id }, data: { clientName: parsed.data.clientName, model: parsed.data.model, imei: parsed.data.imei, problem: parsed.data.problem, updatedById: actor.id } }); await createEvent(tx, current.id, actor, "DETAILS_UPDATED", { beforeData: current, afterData: updated }); await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.details.update", module: "garantias", entityType: "WarrantyCase", entityId: current.id, beforeData: auditData(current), afterData: auditData(updated) } }); return updated; }); revalidatePath("/garantias"); return ok(result); } catch (error) { return fail(error); }
}

async function flow(input: unknown, operation: "assign" | "receive-repaired" | "receive-unrepaired" | "send-supplier" | "receive-supplier" | "deliver" | "credit"): Promise<Result<unknown>> {
  try {
    const actor = await requirePermission("warranties.transition"); const parsed = flowSchema.safeParse(input); if (!parsed.success) return fail("Datos del flujo inválidos.");
    const data = parsed.data; const reasonRequired = operation === "receive-unrepaired" || operation === "credit"; if (reasonRequired && !data.reason) return fail("El motivo es obligatorio.");
    const result = await prisma.$transaction(async (tx) => {
      const cases = await tx.warrantyCase.findMany({ where: { caseCode: { in: data.caseCodes }, archivedAt: null } }); if (cases.length !== data.caseCodes.length) throw new Error("Uno o más casos no existen o están archivados.");
      let toStatus: WarrantyStatus; let documentType: WarrantyDocumentType | null = null; let eventType: WarrantyEventType = "STATUS_CHANGED"; let allowed: WarrantyStatus[];
      if (operation === "assign") { toStatus = "IN_REPAIR"; allowed = ["RECEIVED"]; documentType = "TECHNICIAN_ASSIGNMENT"; eventType = "ASSIGNED_TO_TECHNICIAN"; }
      else if (operation === "receive-repaired") { toStatus = "RECEIVED_FROM_TECHNICIAN"; allowed = ["IN_REPAIR"]; documentType = "TECHNICIAN_RECEIPT_REPAIRED"; eventType = "RECEIVED_REPAIRED"; }
      else if (operation === "receive-unrepaired") { toStatus = "RECEIVED"; allowed = ["IN_REPAIR"]; documentType = "TECHNICIAN_RECEIPT_UNREPAIRED"; eventType = "RECEIVED_UNREPAIRED"; }
      else if (operation === "send-supplier") { toStatus = "SENT_TO_SUPPLIER"; allowed = ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN"]; documentType = "SUPPLIER_SHIPMENT"; eventType = "SENT_TO_SUPPLIER"; }
      else if (operation === "receive-supplier") { toStatus = "RECEIVED_FROM_SUPPLIER"; allowed = ["SENT_TO_SUPPLIER"]; documentType = "SUPPLIER_RECEIPT"; eventType = "RECEIVED_FROM_SUPPLIER"; }
      else if (operation === "deliver") { toStatus = "DELIVERED"; allowed = ["RECEIVED", "RECEIVED_FROM_TECHNICIAN", "RECEIVED_FROM_SUPPLIER"]; documentType = "CUSTOMER_DELIVERY"; eventType = "DELIVERED_TO_CUSTOMER"; }
      else { toStatus = "CREDIT_NOTE"; allowed = ["RECEIVED", "IN_REPAIR", "RECEIVED_FROM_TECHNICIAN", "SENT_TO_SUPPLIER", "RECEIVED_FROM_SUPPLIER"]; eventType = "CREDIT_NOTE_MARKED"; }
      if (cases.some((item) => !allowed.includes(item.status) || (operation === "deliver" && item.clientName.trim().toLowerCase() !== (data.counterpartyName ?? "").trim().toLowerCase()))) throw new Error("Uno o más casos no están en un estado elegible para este flujo.");
      for (const item of cases) { const update: Prisma.WarrantyCaseUpdateInput = { status: toStatus, updatedBy: { connect: { id: actor.id } }, ...(operation === "assign" ? { assignedTechnicianName: data.counterpartyName } : {}), ...(operation === "send-supplier" ? { currentSupplierName: data.counterpartyName } : {}) }; await tx.warrantyCase.update({ where: { id: item.id }, data: update }); await createEvent(tx, item.id, actor, eventType, { fromStatus: item.status, toStatus, counterpartyName: data.counterpartyName, reason: data.reason }); }
      const document = documentType ? await createDocument(tx, actor.id, documentType, data.counterpartyName ?? "", cases.map((item) => item.id), data.reason) : null;
      await tx.auditLog.create({ data: { userId: actor.id, action: `warranty.${operation}`, module: "garantias", entityType: "WarrantyCase", entityId: cases[0].id, afterData: auditData({ caseCodes: data.caseCodes, toStatus, counterpartyName: data.counterpartyName, reason: data.reason, documentCode: document?.documentCode }) } });
      return { documentCode: document?.documentCode ?? null, status: toStatus };
    });
    revalidatePath("/garantias"); return ok(result);
  } catch (error) { return fail(error); }
}

export async function assignCasesToTechnician(input: unknown) { return flow(input, "assign"); }
export async function receiveCasesFromTechnician(input: unknown, repaired: boolean) { return flow(input, repaired ? "receive-repaired" : "receive-unrepaired"); }
export async function sendCasesToSupplier(input: unknown) { return flow(input, "send-supplier"); }
export async function receiveCasesFromSupplier(input: unknown) { return flow(input, "receive-supplier"); }
export async function deliverCasesToCustomer(input: unknown) { return flow(input, "deliver"); }
export async function markWarrantyCreditNote(input: unknown) { return flow(input, "credit"); }

export async function listWarrantyDocuments(): Promise<Result<unknown[]>> { try { await requirePermission("warranties.documents"); return ok(await prisma.warrantyDocument.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { items: { include: { case: true }, orderBy: { sortOrder: "asc" } } } })); } catch (error) { return fail(error); } }
export async function getWarrantyDocument(documentCode: string): Promise<Result<unknown>> { try { await requirePermission("warranties.documents"); const document = await prisma.warrantyDocument.findUnique({ where: { documentCode }, include: { items: { include: { case: true }, orderBy: { sortOrder: "asc" } } } }); return document ? ok(document) : fail("Documento no encontrado."); } catch (error) { return fail(error); } }
export async function archiveWarrantyCase(caseCode: string, reason: string): Promise<Result<unknown>> { try { const actor = await requirePermission("warranties.archive"); if (!reason.trim()) return fail("El motivo es obligatorio."); const item = await prisma.$transaction(async (tx) => { const current = await tx.warrantyCase.findUnique({ where: { caseCode } }); if (!current) throw new Error("Caso no encontrado."); const archived = await tx.warrantyCase.update({ where: { id: current.id }, data: { archivedAt: new Date(), archivedById: actor.id, updatedById: actor.id } }); await createEvent(tx, current.id, actor, "ARCHIVED", { reason }); await tx.auditLog.create({ data: { userId: actor.id, action: "warranty.archive", module: "garantias", entityType: "WarrantyCase", entityId: current.id, beforeData: auditData(current), afterData: auditData({ archivedAt: archived.archivedAt, reason }) } }); return archived; }); revalidatePath("/garantias"); return ok(item); } catch (error) { return fail(error); } }
