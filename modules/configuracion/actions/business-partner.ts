"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { businessPartnerSchema, type BusinessPartnerInput } from "@/lib/validation/business-partner";

const viewSelect = { id: true, name: true, kind: true, taxId: true, contactName: true, phone: true, email: true, address: true, notes: true, status: true } satisfies Prisma.BusinessPartnerSelect;

function errorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "Ya existe un registro con ese nombre y tipo.";
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return "El catálogo todavía no está instalado. Aplica la migración preparada.";
  return error instanceof Error ? error.message : "No se pudo procesar el registro.";
}

export async function listBusinessPartnersAction(kind?: "CUSTOMER" | "SUPPLIER") {
  try {
    await requirePermission("warranties.create");
    const rows = await prisma.businessPartner.findMany({ where: { status: "ACTIVE", ...(kind ? { kind: { in: [kind, "BOTH"] } } : {}) }, orderBy: { name: "asc" }, select: viewSelect });
    return { success: true as const, data: rows };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function saveBusinessPartnerAction(input: BusinessPartnerInput) {
  try {
    const actor = await requirePermission("settings.write");
    const data = businessPartnerSchema.parse(input);
    const row = data.id
      ? await prisma.businessPartner.update({ where: { id: data.id }, data: { ...data, id: undefined, taxId: data.taxId ?? null, contactName: data.contactName ?? null, phone: data.phone ?? null, email: data.email ?? null, address: data.address ?? null, notes: data.notes ?? null }, select: viewSelect })
      : await prisma.businessPartner.create({ data: { name: data.name, kind: data.kind, taxId: data.taxId, contactName: data.contactName, phone: data.phone, email: data.email, address: data.address, notes: data.notes, status: data.status, createdById: actor.id }, select: viewSelect });
    await logAudit({ userId: actor.id, action: data.id ? "business_partner.update" : "business_partner.create", module: "configuracion", entityType: "business_partner", entityId: row.id, afterData: { name: row.name, kind: row.kind, status: row.status } });
    revalidatePath("/configuracion/clientes-proveedores");
    return { success: true as const, data: row };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function deactivateBusinessPartnerAction(id: string) {
  try {
    const actor = await requirePermission("settings.write");
    const row = await prisma.businessPartner.update({ where: { id }, data: { status: "INACTIVE" }, select: viewSelect });
    await logAudit({ userId: actor.id, action: "business_partner.deactivate", module: "configuracion", entityType: "business_partner", entityId: row.id, afterData: { name: row.name, status: row.status } });
    revalidatePath("/configuracion/clientes-proveedores");
    return { success: true as const, data: row };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function ensureCustomerForWarranty(name: string, actorId: string, tx: Prisma.TransactionClient) {
  const normalized = name.trim();
  const existing = await tx.businessPartner.findFirst({ where: { name: { equals: normalized, mode: "insensitive" }, kind: { in: ["CUSTOMER", "BOTH"] } } });
  if (existing) return existing.id;
  const created = await tx.businessPartner.create({ data: { name: normalized, kind: "CUSTOMER", createdById: actorId } });
  return created.id;
}
