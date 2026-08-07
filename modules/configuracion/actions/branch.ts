"use server";

import { prisma } from "@/lib/db/prisma";
import { branchSchema, BranchInput } from "@/lib/validation/branch";
import { revalidatePath } from "next/cache";

const defaultBranches = [
  { name: "Almacén Casita", code: "CASITA", address: "Almacén Principal La Casita", phone: "809-555-0100" },
  { name: "Sucursal Principal", code: "PRINCIPAL", address: "Av. 27 de Febrero #100, Santo Domingo", phone: "809-555-0101" },
  { name: "Almacén Central", code: "CENTRAL", address: "Zona Industrial Herrera, Santo Domingo", phone: "809-555-0102" },
  { name: "Sucursal Bella Vista", code: "BELLA-VISTA", address: "Av. Rómulo Betancourt #450, Santo Domingo", phone: "809-555-0103" },
  { name: "Sucursal Santiago", code: "SANTIAGO", address: "Calle del Sol #80, Santiago de los Caballeros", phone: "809-555-0104" },
  { name: "Sucursal Megacentro", code: "MEGACENTRO", address: "Av. San Vicente de Paul, Santo Domingo Este", phone: "809-555-0105" },
];

/**
 * Garantiza que existan las sucursales por defecto la primera vez
 */
async function ensureDefaultBranches() {
  try {
    for (const b of defaultBranches) {
      await prisma.branch.upsert({
        where: { name: b.name },
        update: {},
        create: {
          name: b.name,
          code: b.code,
          address: b.address,
          phone: b.phone,
          status: "ACTIVE",
        },
      });
    }
  } catch (err) {
    console.warn("Error inicializando sucursales por defecto:", err);
  }
}

/**
 * Obtiene todas las sucursales activas o filtradas
 */
export async function getBranchesAction(activeOnly = false) {
  try {
    await ensureDefaultBranches();

    const where = activeOnly ? { status: "ACTIVE" } : {};
    const branches = await prisma.branch.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: branches };
  } catch (error: any) {
    return { success: false, error: "Error al obtener sucursales", data: [] };
  }
}

/**
 * Crea o actualiza una sucursal
 */
export async function saveBranchAction(input: BranchInput) {
  try {
    const validated = branchSchema.parse(input);

    if (validated.id) {
      const updated = await prisma.branch.update({
        where: { id: validated.id },
        data: {
          name: validated.name,
          code: validated.code || null,
          address: validated.address || null,
          phone: validated.phone || null,
          status: validated.status || "ACTIVE",
        },
      });

      revalidatePath("/configuracion/sucursales");
      revalidatePath("/almacen/recibos");
      return { success: true, data: updated, message: "Sucursal actualizada exitosamente" };
    }

    const created = await prisma.branch.create({
      data: {
        name: validated.name,
        code: validated.code || null,
        address: validated.address || null,
        phone: validated.phone || null,
        status: validated.status || "ACTIVE",
      },
    });

    revalidatePath("/configuracion/sucursales");
    revalidatePath("/almacen/recibos");
    return { success: true, data: created, message: "Sucursal creada exitosamente" };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al guardar la sucursal" };
  }
}

/**
 * Elimina una sucursal por ID
 */
export async function deleteBranchAction(id: string) {
  try {
    await prisma.branch.delete({
      where: { id },
    });

    revalidatePath("/configuracion/sucursales");
    revalidatePath("/almacen/recibos");
    return { success: true, message: "Sucursal eliminada" };
  } catch (error: any) {
    return { success: false, error: "Error al eliminar la sucursal" };
  }
}
