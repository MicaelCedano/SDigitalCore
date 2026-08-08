"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { branchSchema, type BranchInput } from "@/lib/validation/branch";

export async function getBranchesAction(activeOnly = false) {
  try {
    await requireUser();
    const branches = await prisma.branch.findMany({
      where: activeOnly ? { status: "ACTIVE" } : {},
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: branches };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener sucursales", data: [] };
  }
}

export async function saveBranchAction(input: BranchInput) {
  try {
    const actor = await requirePermission("settings.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const data = branchSchema.parse(input);
    const branch = data.id
      ? await prisma.branch.update({
          where: { id: data.id },
          data: { name: data.name, code: data.code || null, address: data.address || null, phone: data.phone || null, status: data.status },
        })
      : await prisma.branch.create({
          data: { name: data.name, code: data.code || null, address: data.address || null, phone: data.phone || null, status: data.status },
        });

    await logAudit({
      userId: actor.id,
      action: data.id ? "branch.update" : "branch.create",
      module: "configuracion",
      entityType: "branch",
      entityId: branch.id,
      afterData: { name: branch.name, code: branch.code, status: branch.status },
    });
    revalidatePath("/configuracion/sucursales");
    revalidatePath("/almacen/recibos");
    return { success: true, data: branch, message: data.id ? "Sucursal actualizada exitosamente" : "Sucursal creada exitosamente" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al guardar la sucursal" };
  }
}

export async function deleteBranchAction(id: string) {
  try {
    const actor = await requirePermission("settings.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const branch = await prisma.branch.update({ where: { id }, data: { status: "INACTIVE" } });
    await logAudit({ userId: actor.id, action: "branch.deactivate", module: "configuracion", entityType: "branch", entityId: id, afterData: { status: branch.status } });
    revalidatePath("/configuracion/sucursales");
    revalidatePath("/almacen/recibos");
    return { success: true, message: "Sucursal desactivada" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al desactivar la sucursal" };
  }
}
