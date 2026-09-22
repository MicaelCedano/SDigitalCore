"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { stockCountSchema, StockCountInput } from "@/lib/validation/stock-count";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";

/**
 * Genera un número de folio correlativo único para conteo (Ej: CNT-20260807-001)
 */
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
        if (existing.status !== "IN_PROGRESS") {
          return { success: false, error: "Solo los conteos en proceso pueden modificarse." };
        }
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
    const created = await prisma.$transaction(async (tx) => {
      const countNumber = await nextOperationalNumber(tx, "STOCK_COUNT", "CNT");
      return tx.stockCount.create({ data: {
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
      include: { items: true },
      });
    });
    await logAudit({ userId: user.id, action: "stock_count.create", module: "almacen", entityType: "stock_count", entityId: created.id, afterData: { countNumber: created.countNumber, status: created.status, itemCount: created.items.length } });

    revalidatePath("/almacen/conteos");
    return { success: true, data: created, message: `Conteo ${created.countNumber} registrado exitosamente` };
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
        items: {
          orderBy: { description: "asc" },
        },
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
        items: {
          orderBy: { description: "asc" },
        },
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
    const existing = await prisma.stockCount.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Conteo no encontrado" };
    if (existing.status === "CANCELLED") return { success: false, error: "El conteo ya está anulado" };
    const cancelled = await prisma.stockCount.update({ where: { id }, data: { status: "CANCELLED", completedAt: null } });
    await logAudit({ userId: actor.id, action: "stock_count.cancel", module: "almacen", entityType: "stock_count", entityId: cancelled.id, beforeData: { countNumber: existing.countNumber, status: existing.status }, afterData: { status: cancelled.status } });

    revalidatePath("/almacen/conteos");
    return { success: true, message: "Conteo anulado; su historial fue conservado" };
  } catch (error: any) {
    return { success: false, error: "Error al anular el conteo" };
  }
}

/**
 * Sincroniza un conteo en progreso con las existencias actuales de almacén,
 * actualizando el stock esperado, recalculando diferencias y agregando nuevos modelos
 * sin perder las cantidades ya contadas ni los IMEIs escaneados.
 */
export async function syncStockCountWithWarehouseAction(countId: string) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };

    const count = await prisma.stockCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });

    if (!count) return { success: false, error: "Conteo no encontrado" };
    if (count.status !== "IN_PROGRESS") {
      return { success: false, error: "Solo se pueden sincronizar conteos en progreso." };
    }

    // Obtener todos los productos activos de almacén
    const warehouseProducts = await prisma.warehouseProduct.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    const warehouseInfoList = warehouseProducts.map((p) => {
      const brand = p.brand ? `${p.brand} ` : "";
      const name = p.name || "";
      const color = p.color ? ` ${p.color}` : "";
      const capacity = p.capacity ? ` ${p.capacity}` : "";
      const fullName = `${brand}${name}${color}${capacity}`.replace(/\s+/g, " ").trim();
      const expectedUnits = (p.boxes || 0) * (p.unitsPerBox || 1) + (p.looseUnits || 0);
      const notes = p.boxes > 0 ? `${p.boxes} cajas (${p.unitsPerBox} c/u) + ${p.looseUnits || 0} sueltas` : "";

      return {
        product: p,
        code: (p.code || "").trim(),
        codeUpper: (p.code || "").trim().toUpperCase(),
        fullName,
        normalizedDesc: fullName.toLowerCase().replace(/\s+/g, " "),
        expectedUnits,
        notes,
      };
    });

    const matchedProductCodes = new Set<string>();
    const matchedProductIds = new Set<string>();

    // 1. Actualizar items existentes
    const updatedItems = count.items.map((item) => {
      const itemCode = (item.code || "").trim().toUpperCase();
      const itemDesc = (item.description || "").toLowerCase().replace(/\s+/g, " ").trim();

      // Buscar por código exacto o descripción normalizada
      const matched = warehouseInfoList.find((w) => {
        if (itemCode && w.codeUpper === itemCode) return true;
        if (itemDesc && w.normalizedDesc === itemDesc) return true;
        return false;
      });

      if (matched) {
        matchedProductCodes.add(matched.codeUpper);
        matchedProductIds.add(matched.product.id);
        const expected = matched.expectedUnits;
        const counted = Number(item.countedQty) || 0;
        return {
          code: item.code || matched.code || null,
          description: item.description || matched.fullName,
          expectedQty: expected,
          countedQty: counted,
          difference: counted - expected,
          scannedImeis: item.scannedImeis || null,
          notes: matched.notes || item.notes || null,
        };
      }

      // Si no hace match con almacén, conservar el item tal cual
      const exp = Number(item.expectedQty) || 0;
      const cnt = Number(item.countedQty) || 0;
      return {
        code: item.code || null,
        description: item.description,
        expectedQty: exp,
        countedQty: cnt,
        difference: cnt - exp,
        scannedImeis: item.scannedImeis || null,
        notes: item.notes || null,
      };
    });

    // 2. Agregar modelos nuevos del almacén con stock > 0 que no estaban en el conteo
    let addedCount = 0;
    for (const w of warehouseInfoList) {
      if (!matchedProductCodes.has(w.codeUpper) && !matchedProductIds.has(w.product.id)) {
        if (w.expectedUnits > 0) {
          updatedItems.push({
            code: w.code || null,
            description: w.fullName,
            expectedQty: w.expectedUnits,
            countedQty: 0,
            difference: -w.expectedUnits,
            scannedImeis: null,
            notes: w.notes || null,
          });
          addedCount++;
        }
      }
    }

    // 3. Guardar en transacción
    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockCountItem.deleteMany({
        where: { countId: count.id },
      });

      return tx.stockCount.update({
        where: { id: count.id },
        data: {
          items: {
            create: updatedItems,
          },
        },
        include: {
          items: true,
        },
      });
    });

    await logAudit({
      userId: user.id,
      action: "stock_count.sync_warehouse",
      module: "almacen",
      entityType: "stock_count",
      entityId: updated.id,
      afterData: {
        countNumber: updated.countNumber,
        status: updated.status,
        itemCount: updated.items.length,
        addedNewModels: addedCount,
      },
    });

    revalidatePath("/almacen/conteos");
    return {
      success: true,
      data: updated,
      message: `Conteo sincronizado: se actualizaron las existencias esperadas y se agregaron ${addedCount} modelos nuevos sin perder lo contado.`,
    };
  } catch (error: any) {
    console.error("Error al sincronizar conteo con almacén:", error);
    return { success: false, error: error.message || "Error al sincronizar con almacén" };
  }
}

/**
 * Reconcilia y actualiza las existencias de Almacén para que coincidan exactamente
 * con las cantidades físicas contadas en una auditoría (Solo Administradores).
 * Genera movimientos de entrada o salida por ajuste para cada discrepancia.
 */
export async function applyStockCountToWarehouseAction(countId: string) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };

    const persisted = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { roleCode: true, name: true, email: true },
    });

    if (persisted?.roleCode !== "ADMIN") {
      return { success: false, error: "Solo un administrador puede aplicar el conteo al inventario de almacén." };
    }

    const count = await prisma.stockCount.findUnique({
      where: { id: countId },
      include: {
        items: {
          orderBy: { description: "asc" },
        },
      },
    });

    if (!count) return { success: false, error: "Conteo no encontrado" };
    if (count.status !== "COMPLETED") {
      return {
        success: false,
        error: "La auditoría debe estar finalizada para poder sincronizar y ajustar el inventario de almacén.",
      };
    }

    const warehouseProducts = await prisma.warehouseProduct.findMany({
      where: { status: "ACTIVE" },
    });

    const warehouseInfoList = warehouseProducts.map((p) => {
      const brand = p.brand ? `${p.brand} ` : "";
      const name = p.name || "";
      const color = p.color ? ` ${p.color}` : "";
      const capacity = p.capacity ? ` ${p.capacity}` : "";
      const fullName = `${brand}${name}${color}${capacity}`.replace(/\s+/g, " ").trim();
      const currentUnits = (p.boxes || 0) * (p.unitsPerBox || 1) + (p.looseUnits || 0);

      return {
        product: p,
        codeUpper: (p.code || "").trim().toUpperCase(),
        fullName,
        normalizedDesc: fullName.toLowerCase().replace(/\s+/g, " "),
        currentUnits,
      };
    });

    const adjustments: Array<{
      productId: string;
      productName: string;
      oldStock: number;
      newStock: number;
      diff: number;
      newBoxes: number;
      newLoose: number;
      unitsPerBox: number;
      countItemId: string;
    }> = [];

    for (const item of count.items) {
      const itemCode = (item.code || "").trim().toUpperCase();
      const itemDesc = (item.description || "").toLowerCase().replace(/\s+/g, " ").trim();

      const matched = warehouseInfoList.find((w) => {
        if (itemCode && w.codeUpper === itemCode) return true;
        if (itemDesc && w.normalizedDesc === itemDesc) return true;
        return false;
      });

      if (matched) {
        const counted = Number(item.countedQty) || 0;
        const currentStock = matched.currentUnits;
        const diff = counted - currentStock;

        if (diff !== 0) {
          const upb = Math.max(1, matched.product.unitsPerBox || 1);
          const newBoxes = Math.floor(counted / upb);
          const newLoose = counted % upb;

          adjustments.push({
            productId: matched.product.id,
            productName: matched.fullName,
            oldStock: currentStock,
            newStock: counted,
            diff,
            newBoxes,
            newLoose,
            unitsPerBox: upb,
            countItemId: item.id,
          });
        }
      }
    }

    if (adjustments.length === 0) {
      return {
        success: true,
        message: "El inventario de Almacén ya coincide exactamente con las cantidades contadas físicas. No fue necesario realizar ajustes.",
        adjustedCount: 0,
      };
    }

    const createdByName = persisted.name || persisted.email || actor.id;

    await prisma.$transaction(async (tx) => {
      for (const adj of adjustments) {
        await tx.warehouseProduct.update({
          where: { id: adj.productId },
          data: {
            boxes: adj.newBoxes,
            looseUnits: adj.newLoose,
            totalUnits: adj.newStock,
          },
        });

        await tx.warehouseMovement.create({
          data: {
            productId: adj.productId,
            type: adj.diff > 0 ? "ENTRY" : "EXIT",
            boxesCount: Math.abs(Math.floor(adj.diff / adj.unitsPerBox)),
            totalUnits: Math.abs(adj.diff),
            reason: `Ajuste por auditoría física ${count.countNumber} (${adj.diff > 0 ? "+" : ""}${adj.diff} uds)`,
            createdBy: createdByName,
          },
        });

        await tx.stockCountItem.update({
          where: { id: adj.countItemId },
          data: {
            expectedQty: adj.newStock,
            difference: 0,
            notes: `${adj.newBoxes} cajas (${adj.unitsPerBox} c/u) + ${adj.newLoose} sueltas · Almacén ajustado al físico`,
          },
        });
      }

      await tx.stockCount.update({
        where: { id: count.id },
        data: {
          status: "COMPLETED",
          completedAt: count.completedAt || new Date(),
        },
      });

      await logAudit({
        userId: actor.id,
        action: "stock_count.reconcile_warehouse",
        module: "almacen",
        entityType: "stock_count",
        entityId: count.id,
        afterData: {
          countNumber: count.countNumber,
          adjustedCount: adjustments.length,
          adjustments: adjustments.map((a) => ({
            product: a.productName,
            diff: a.diff,
            newStock: a.newStock,
          })),
        },
      });
    });

    revalidatePath("/almacen");
    revalidatePath("/almacen/conteos");
    revalidatePath("/almacen/movimientos");

    return {
      success: true,
      data: { adjustedCount: adjustments.length },
      message: `¡Almacén sincronizado exitosamente! Se ajustó el stock de ${adjustments.length} productos y se registraron sus movimientos en la bitácora.`,
    };
  } catch (error: any) {
    console.error("Error al aplicar conteo al almacén:", error);
    return { success: false, error: error.message || "Error al sincronizar almacén con el conteo físico" };
  }
}
