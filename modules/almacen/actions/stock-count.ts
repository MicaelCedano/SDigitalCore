"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { stockCountSchema, StockCountInput } from "@/lib/validation/stock-count";

/**
 * Genera un número de folio correlativo único para conteo (Ej: CNT-20260807-001)
 */
async function generateCountNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CNT-${dateStr}-`;

  const countToday = await prisma.stockCount.count({
    where: {
      countNumber: {
        startsWith: prefix,
      },
    },
  });

  const nextNum = (countToday + 1).toString().padStart(3, "0");
  return `${prefix}${nextNum}`;
}

/**
 * Crea o guarda una auditoría de conteo de stock (En Proceso o Completado)
 */
export async function saveStockCountAction(input: StockCountInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = stockCountSchema.parse(input);
    const branchExists = await prisma.branch.findFirst({ where: { name: validated.branch, status: "ACTIVE" }, select: { id: true } });
    if (!branchExists) return { success: false, error: "La sucursal seleccionada no existe o está inactiva." };
    const performedBy = user.name || user.email || user.id;

    // Si ya tiene ID, actualizamos
    if (validated.id) {
      const existing = await prisma.stockCount.findUnique({
        where: { id: validated.id },
      });

      if (existing) {
        const updated = await prisma.$transaction(async (tx) => {
          await tx.stockCountItem.deleteMany({
            where: { countId: validated.id },
          });

          return tx.stockCount.update({
            where: { id: validated.id },
            data: {
              title: validated.title,
              branch: validated.branch,
              performedBy: performedBy,
              status: validated.status,
              notes: validated.notes,
              completedAt: validated.status === "COMPLETED" ? new Date() : null,
              items: {
                create: validated.items.map((item) => {
                  const expected = Number(item.expectedQty) || 0;
                  const counted = Number(item.countedQty) || 0;
                  const diff = counted - expected;

                  return {
                    code: item.code || null,
                    description: item.description,
                    expectedQty: expected,
                    countedQty: counted,
                    difference: diff,
                    scannedImeis: item.scannedImeis || null,
                    notes: item.notes || null,
                  };
                }),
              },
            },
            include: {
              items: true,
            },
          });
        });
        await logAudit({ userId: user.id, action: "stock_count.update", module: "almacen", entityType: "stock_count", entityId: updated.id, afterData: { countNumber: updated.countNumber, status: updated.status, itemCount: updated.items.length } });

        revalidatePath("/almacen/conteos");
        return { success: true, data: updated, message: "Conteo de stock actualizado exitosamente" };
      }
    }

    // Crear nuevo conteo
    const countNumber = await generateCountNumber();

    const created = await prisma.stockCount.create({
      data: {
        countNumber,
        title: validated.title,
        branch: validated.branch,
        performedBy: performedBy,
        status: validated.status,
        notes: validated.notes,
        completedAt: validated.status === "COMPLETED" ? new Date() : null,
        items: {
          create: validated.items.map((item) => {
            const expected = Number(item.expectedQty) || 0;
            const counted = Number(item.countedQty) || 0;
            const diff = counted - expected;

            return {
              code: item.code || null,
              description: item.description,
              expectedQty: expected,
              countedQty: counted,
              difference: diff,
              scannedImeis: item.scannedImeis || null,
              notes: item.notes || null,
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });
    await logAudit({ userId: user.id, action: "stock_count.create", module: "almacen", entityType: "stock_count", entityId: created.id, afterData: { countNumber: created.countNumber, status: created.status, itemCount: created.items.length } });

    revalidatePath("/almacen/conteos");
    return { success: true, data: created, message: `Conteo ${countNumber} registrado exitosamente` };
  } catch (error: any) {
    console.error("Error al guardar conteo de stock:", error);
    return {
      success: false,
      error: error.message || "Error al procesar el conteo de stock",
    };
  }
}

/**
 * Obtiene el historial de auditorías de conteo con filtros
 */
export async function getStockCountsAction(query?: string, status?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { countNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { performedBy: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { description: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { scannedImeis: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const counts = await prisma.stockCount.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: counts };
  } catch (error: any) {
    console.error("Error al consultar conteos:", error);
    return { success: false, error: "Error al obtener conteos de stock", data: [] };
  }
}

/**
 * Obtiene el detalle de un conteo por ID
 */
export async function getStockCountByIdAction(id: string) {
  try {
    await requirePermission("warehouse.read");
    const count = await prisma.stockCount.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!count) {
      return { success: false, error: "Conteo no encontrado" };
    }

    return { success: true, data: count };
  } catch (error: any) {
    return { success: false, error: "Error al cargar el conteo" };
  }
}

/**
 * Elimina una auditoría de conteo
 */
export async function deleteStockCountAction(id: string) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const deleted = await prisma.stockCount.delete({
      where: { id },
    });
    await logAudit({ userId: actor.id, action: "stock_count.delete", module: "almacen", entityType: "stock_count", entityId: deleted.id, beforeData: { countNumber: deleted.countNumber, status: deleted.status } });

    revalidatePath("/almacen/conteos");
    return { success: true, message: "Conteo eliminado" };
  } catch (error: any) {
    return { success: false, error: "Error al eliminar el conteo" };
  }
}
