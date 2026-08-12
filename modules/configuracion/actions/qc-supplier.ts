"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { qcSupplierIdSchema, qcSupplierSchema, type QcSupplierInput } from "@/lib/validation/qc-supplier";

const supplierViewSelect = {
  id: true,
  name: true,
  contactName: true,
  phone: true,
  email: true,
  notes: true,
  status: true,
} satisfies Prisma.QcSupplierSelect;

function errorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return "La tabla de proveedores QC todavía no está instalada. Aplica la migración para guardar cambios.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Ya existe un proveedor de control de calidad con ese nombre.";
  }
  return error instanceof Error ? error.message : "No se pudo procesar el proveedor.";
}

export async function saveQcSupplierAction(input: QcSupplierInput) {
  try {
    const actor = await requirePermission("settings.write");
    const data = qcSupplierSchema.parse(input);
    const duplicate = await prisma.qcSupplier.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        ...(data.id ? { id: { not: data.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      return { success: false as const, error: "Ya existe un proveedor de control de calidad con ese nombre." };
    }

    const supplier = data.id
      ? await prisma.qcSupplier.update({
          where: { id: data.id },
          data: {
            name: data.name,
            contactName: data.contactName ?? null,
            phone: data.phone ?? null,
            email: data.email ?? null,
            notes: data.notes ?? null,
            status: data.status,
          },
          select: supplierViewSelect,
        })
      : await prisma.qcSupplier.create({
          data: {
            name: data.name,
            contactName: data.contactName,
            phone: data.phone,
            email: data.email,
            notes: data.notes,
            status: data.status,
          },
          select: supplierViewSelect,
        });

    await logAudit({
      userId: actor.id,
      action: data.id ? "qc_supplier.update" : "qc_supplier.create",
      module: "configuracion",
      entityType: "qc_supplier",
      entityId: supplier.id,
      afterData: { name: supplier.name, status: supplier.status },
    });
    revalidatePath("/configuracion/proveedores-qc");
    return { success: true as const, data: supplier };
  } catch (error) {
    return { success: false as const, error: errorMessage(error) };
  }
}

export async function deactivateQcSupplierAction(id: string) {
  try {
    const actor = await requirePermission("settings.write");
    const supplierId = qcSupplierIdSchema.parse(id);
    const supplier = await prisma.qcSupplier.update({
      where: { id: supplierId },
      data: { status: "INACTIVE" },
      select: supplierViewSelect,
    });
    await logAudit({
      userId: actor.id,
      action: "qc_supplier.deactivate",
      module: "configuracion",
      entityType: "qc_supplier",
      entityId: supplier.id,
      afterData: { name: supplier.name, status: supplier.status },
    });
    revalidatePath("/configuracion/proveedores-qc");
    return { success: true as const, data: supplier };
  } catch (error) {
    return { success: false as const, error: errorMessage(error) };
  }
}
