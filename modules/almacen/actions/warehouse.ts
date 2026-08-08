"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  warehouseProductSchema,
  warehouseMovementSchema,
  warehouseRequestSchema,
  WarehouseProductInput,
  WarehouseMovementInput,
  WarehouseRequestInput,
} from "@/lib/validation/warehouse";

/**
 * Obtiene la lista de productos de almacén con sus cajas y unidades totales
 */
export async function getWarehouseProductsAction(query?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: any = {};
    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        { capacity: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.warehouseProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: products };
  } catch (error: any) {
    return { success: false, error: "Error al cargar productos de almacén", data: [] };
  }
}

/**
 * Crea o actualiza un producto en almacén
 */
export async function createWarehouseProductAction(input: WarehouseProductInput) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseProductSchema.parse(input);
    const boxes = Number(validated.boxes) || 0;
    const unitsPerBox = Number(validated.unitsPerBox) || 1;
    const totalUnits = boxes * unitsPerBox;

    if (validated.id) {
      const updated = await prisma.warehouseProduct.update({
        where: { id: validated.id },
        data: {
          code: validated.code.toUpperCase().trim(),
          name: validated.name.trim(),
          brand: validated.brand?.trim() || null,
          color: validated.color?.trim() || null,
          capacity: validated.capacity?.trim() || null,
          description: validated.description?.trim() || null,
          boxes,
          unitsPerBox,
          totalUnits,
        },
      });
      await logAudit({ userId: actor.id, action: "warehouse_product.update", module: "almacen", entityType: "warehouse_product", entityId: updated.id, afterData: { code: updated.code, name: updated.name, boxes: updated.boxes } });

      revalidatePath("/almacen");
      return { success: true, data: updated, message: "Producto actualizado exitosamente" };
    }

    // Verificar código duplicado
    const existing = await prisma.warehouseProduct.findUnique({
      where: { code: validated.code.toUpperCase().trim() },
    });

    if (existing) {
      return { success: false, error: "El código de producto ya existe en almacén" };
    }

    const created = await prisma.warehouseProduct.create({
      data: {
        code: validated.code.toUpperCase().trim(),
        name: validated.name.trim(),
        brand: validated.brand?.trim() || null,
        color: validated.color?.trim() || null,
        capacity: validated.capacity?.trim() || null,
        description: validated.description?.trim() || null,
        boxes,
        unitsPerBox,
        totalUnits,
      },
    });
    await logAudit({ userId: actor.id, action: "warehouse_product.create", module: "almacen", entityType: "warehouse_product", entityId: created.id, afterData: { code: created.code, name: created.name, boxes: created.boxes } });

    revalidatePath("/almacen");
    return { success: true, data: created, message: "Producto de almacén registrado exitosamente" };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar producto" };
  }
}

/**
 * Elimina un producto de almacén
 */
export async function deleteWarehouseProductAction(id: string) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const deleted = await prisma.warehouseProduct.delete({
      where: { id },
    });
    await logAudit({ userId: actor.id, action: "warehouse_product.delete", module: "almacen", entityType: "warehouse_product", entityId: deleted.id, beforeData: { code: deleted.code, name: deleted.name } });

    revalidatePath("/almacen");
    return { success: true, message: "Producto eliminado" };
  } catch (error: any) {
    return { success: false, error: "Error al eliminar el producto" };
  }
}

/**
 * Registra un movimiento de Entradas / Salidas de Almacén y recalcula cajas/unidades
 */
export async function createWarehouseMovementAction(input: WarehouseMovementInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseMovementSchema.parse(input);
    const boxesCount = Number(validated.boxesCount) || 1;

    const product = await prisma.warehouseProduct.findUnique({
      where: { id: validated.productId },
    });

    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }

    let newBoxes = product.boxes;

    if (validated.type === "EXIT") {
      if (product.boxes < boxesCount) {
        return {
          success: false,
          error: `Stock insuficiente de cajas. Cajas actuales: ${product.boxes}, solicitadas: ${boxesCount}`,
        };
      }
      newBoxes = product.boxes - boxesCount;
    } else {
      newBoxes = product.boxes + boxesCount;
    }

    const newTotalUnits = newBoxes * product.unitsPerBox;

    const movement = await prisma.$transaction(async (tx) => {
      // 1. Actualizar stock del producto
      await tx.warehouseProduct.update({
        where: { id: product.id },
        data: {
          boxes: newBoxes,
          totalUnits: newTotalUnits,
        },
      });

      // 2. Registrar movimiento en la bitácora
      return tx.warehouseMovement.create({
        data: {
          productId: product.id,
          type: validated.type,
          boxesCount,
          totalUnits: boxesCount * product.unitsPerBox,
          reason: validated.reason.trim(),
          createdBy: user.name || user.email || user.id,
        },
        include: {
          product: true,
        },
      });
    });
    await logAudit({ userId: user.id, action: "warehouse_movement.create", module: "almacen", entityType: "warehouse_movement", entityId: movement.id, afterData: { type: movement.type, boxesCount: movement.boxesCount, productId: movement.productId } });

    revalidatePath("/almacen");
    revalidatePath("/almacen/movimientos");
    return {
      success: true,
      data: movement,
      message: `Movimiento de ${validated.type === "ENTRY" ? "Entrada" : "Salida"} registrado correctamente`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar movimiento" };
  }
}

/**
 * Obtiene el historial de movimientos de almacén
 */
export async function getWarehouseMovementsAction(query?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: any = {};
    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { reason: { contains: q, mode: "insensitive" } },
        { createdBy: { contains: q, mode: "insensitive" } },
        {
          product: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const movements = await prisma.warehouseMovement.findMany({
      where,
      include: {
        product: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: movements };
  } catch (error: any) {
    return { success: false, error: "Error al cargar movimientos de almacén", data: [] };
  }
}

/**
 * Genera un código correlativo para solicitudes (Ej. SOL-20260807-001)
 */
async function generateRequestCode(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SOL-${dateStr}-`;

  const countToday = await prisma.warehouseRequest.count({
    where: {
      requestCode: {
        startsWith: prefix,
      },
    },
  });

  const nextNum = (countToday + 1).toString().padStart(3, "0");
  return `${prefix}${nextNum}`;
}

/**
 * Crea una solicitud de almacén / transferencias
 */
export async function createWarehouseRequestAction(input: WarehouseRequestInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseRequestSchema.parse(input);
    const branchExists = await prisma.branch.findFirst({ where: { name: validated.branch, status: "ACTIVE" }, select: { id: true } });
    if (!branchExists) return { success: false, error: "La sucursal seleccionada no existe o está inactiva." };
    const requestCode = await generateRequestCode();

    const created = await prisma.warehouseRequest.create({
      data: {
        requestCode,
        title: validated.title.trim(),
        branch: validated.branch,
        requestedBy: user.name || user.email || user.id,
        status: validated.status || "PENDING",
        details: validated.details?.trim() || null,
      },
    });
    await logAudit({ userId: user.id, action: "warehouse_request.create", module: "almacen", entityType: "warehouse_request", entityId: created.id, afterData: { requestCode: created.requestCode, status: created.status } });

    revalidatePath("/almacen/transferencias");
    return { success: true, data: created, message: `Solicitud ${requestCode} registrada exitosamente` };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear la solicitud" };
  }
}

/**
 * Obtiene las solicitudes de almacén
 */
export async function getWarehouseRequestsAction(query?: string, status?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { requestCode: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { requestedBy: { contains: q, mode: "insensitive" } },
        { details: { contains: q, mode: "insensitive" } },
      ];
    }

    const requests = await prisma.warehouseRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: requests };
  } catch (error: any) {
    return { success: false, error: "Error al cargar solicitudes", data: [] };
  }
}

/**
 * Actualiza el estado de una solicitud de almacén (Aprobar / Rechazar)
 */
export async function updateWarehouseRequestStatusAction(id: string, status: "APPROVED" | "REJECTED") {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const updated = await prisma.warehouseRequest.update({
      where: { id },
      data: { status },
    });
    await logAudit({ userId: actor.id, action: "warehouse_request.status.update", module: "almacen", entityType: "warehouse_request", entityId: updated.id, afterData: { status: updated.status } });

    revalidatePath("/almacen/transferencias");
    return {
      success: true,
      data: updated,
      message: `Solicitud ${status === "APPROVED" ? "Aprobada" : "Rechazada"}`,
    };
  } catch (error: any) {
    return { success: false, error: "Error al actualizar la solicitud" };
  }
}
