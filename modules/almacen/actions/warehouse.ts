"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  warehouseProductSchema,
  warehouseMovementSchema,
  warehouseBulkMovementSchema,
  warehouseRequestSchema,
  WarehouseProductInput,
  WarehouseMovementInput,
  WarehouseBulkMovementInput,
  WarehouseRequestInput,
} from "@/lib/validation/warehouse";

async function requireWarehouseAdmin() {
  const actor = await requirePermission("warehouse.read");
  const persisted = await prisma.user.findUnique({ where: { id: actor.id }, select: { roleCode: true } });
  if (persisted?.roleCode !== "ADMIN") throw new Error("Solo un administrador puede aprobar o rechazar solicitudes.");
  return actor;
}

function resolveMovementLine(item: { unitsCount: number; measure?: "BOXES" | "UNITS"; quantity?: number }, unitsPerBox: number) {
  const measure = item.measure === "BOXES" ? "BOXES" : "UNITS";
  const quantity = Math.max(1, Number(item.quantity) || (measure === "BOXES" ? Math.ceil(item.unitsCount / Math.max(1, unitsPerBox)) : item.unitsCount));
  return {
    measure,
    quantity,
    unitsCount: measure === "BOXES" ? quantity * Math.max(1, unitsPerBox) : quantity,
    boxesCount: measure === "BOXES" ? quantity : 0,
  };
}

function parseRequestLine(details: string | null | undefined, productId: string, unitsCount: number) {
  try {
    const parsed = details ? JSON.parse(details) : null;
    const line = parsed?.items?.[productId];
    if (line?.measure === "BOXES" || line?.measure === "UNITS") {
      return { measure: line.measure as "BOXES" | "UNITS", quantity: Number(line.quantity) || 1 };
    }
  } catch {
    // Solicitudes antiguas guardan texto plano y se interpretan como unidades sueltas.
  }
  return { measure: "UNITS" as const, quantity: unitsCount };
}

/**
 * Obtiene la lista de productos de almacÃ©n con sus cajas y unidades totales
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
    return { success: false, error: "Error al cargar productos de almacÃ©n", data: [] };
  }
}

/**
 * Crea o actualiza un producto en almacÃ©n
 */
export async function createWarehouseProductAction(input: WarehouseProductInput) {
  try {
    const actor = await requireWarehouseAdmin();
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseProductSchema.parse(input);
    const boxes = Number(validated.boxes) || 0;
    const unitsPerBox = Number(validated.unitsPerBox);
    const looseUnits = Number(validated.looseUnits) || 0;
    const totalUnits = boxes * unitsPerBox + looseUnits;

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
          looseUnits,
          totalUnits,
        },
      });
      await logAudit({ userId: actor.id, action: "warehouse_product.update", module: "almacen", entityType: "warehouse_product", entityId: updated.id, afterData: { code: updated.code, name: updated.name, boxes: updated.boxes, looseUnits: updated.looseUnits, totalUnits: updated.totalUnits } });

      revalidatePath("/almacen");
      return { success: true, data: updated, message: "Producto actualizado exitosamente" };
    }

    // Verificar cÃ³digo duplicado
    const existing = await prisma.warehouseProduct.findUnique({
      where: { code: validated.code.toUpperCase().trim() },
    });

    if (existing) {
      return { success: false, error: "El cÃ³digo de producto ya existe en almacÃ©n" };
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
        looseUnits,
        totalUnits,
      },
    });
    await logAudit({ userId: actor.id, action: "warehouse_product.create", module: "almacen", entityType: "warehouse_product", entityId: created.id, afterData: { code: created.code, name: created.name, boxes: created.boxes, looseUnits: created.looseUnits, totalUnits: created.totalUnits } });

    revalidatePath("/almacen");
    return { success: true, data: created, message: "Producto de almacÃ©n registrado exitosamente" };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar producto" };
  }
}

/**
 * Elimina un producto de almacÃ©n
 */
export async function deleteWarehouseProductAction(id: string) {
  try {
    const actor = await requireWarehouseAdmin();
    if (!actor.id) return { success: false, error: "La sesiÃ³n no tiene un usuario identificable." };
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
 * Registra un movimiento de Entradas / Salidas de AlmacÃ©n y recalcula cajas/unidades
 */
export async function createWarehouseMovementAction(input: WarehouseMovementInput) {
  try {
    const user = await requireWarehouseAdmin();
    if (!user.id) return { success: false, error: "La sesiÃ³n no tiene un usuario identificable." };
    const validated = warehouseMovementSchema.parse(input);
    const product = await prisma.warehouseProduct.findUnique({
      where: { id: validated.productId },
    });

    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }

    const line = resolveMovementLine(validated, product.unitsPerBox);
    const available = line.measure === "BOXES" ? product.boxes : product.looseUnits;
    if (validated.type === "EXIT" && available < line.quantity) {
      return { success: false, error: `Stock insuficiente en ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"}. Disponible: ${available}, solicitado: ${line.quantity}` };
    }

    const newTotalUnits = product.totalUnits + (validated.type === "ENTRY" ? line.unitsCount : -line.unitsCount);
    const newBoxes = validated.type === "EXIT" && line.measure === "BOXES" ? product.boxes - line.quantity : validated.type === "ENTRY" && line.measure === "BOXES" ? product.boxes + line.quantity : product.boxes;
    const newLooseUnits = validated.type === "EXIT" && line.measure === "UNITS" ? product.looseUnits - line.quantity : validated.type === "ENTRY" && line.measure === "UNITS" ? product.looseUnits + line.quantity : product.looseUnits;

    const movement = await prisma.$transaction(async (tx) => {
      // 1. Actualizar stock del producto
      await tx.warehouseProduct.update({
        where: { id: product.id },
        data: {
          boxes: newBoxes,
          looseUnits: newLooseUnits,
          totalUnits: newTotalUnits,
        },
      });

      // 2. Registrar movimiento en la bitÃ¡cora
      return tx.warehouseMovement.create({
        data: {
          productId: product.id,
          type: validated.type,
          boxesCount: line.boxesCount,
          totalUnits: line.unitsCount,
          reason: validated.reason.trim(),
          createdBy: user.name || user.email || user.id,
        },
        include: {
          product: true,
        },
      });
    });
    await logAudit({ userId: user.id, action: "warehouse_movement.create", module: "almacen", entityType: "warehouse_movement", entityId: movement.id, afterData: { type: movement.type, unitsCount: line.unitsCount, measure: line.measure, quantity: line.quantity, productId: movement.productId } });

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

/** Registra una entrada o salida con varios modelos en una sola operaciÃ³n. */
export async function createWarehouseMovementsBulkAction(input: WarehouseBulkMovementInput) {
  try {
    const user = await requireWarehouseAdmin();
    if (!user.id) return { success: false, error: "La sesiÃ³n no tiene un usuario identificable." };
    const validated = warehouseBulkMovementSchema.parse(input);
    const ids = validated.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) return { success: false, error: "No repita el mismo producto en el movimiento." };

    const batch = await prisma.$transaction(async (tx) => {
      const products = await tx.warehouseProduct.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length) throw new Error("Uno de los productos no existe.");
      const byId = new Map(products.map((product) => [product.id, product]));
      const items = [];
      const movements = [];

      for (const item of validated.items) {
        const product = byId.get(item.productId)!;
        const line = resolveMovementLine(item, product.unitsPerBox);
        const available = line.measure === "BOXES" ? product.boxes : product.looseUnits;
        if (validated.type === "EXIT" && available < line.quantity) {
          throw new Error(`Stock insuficiente en ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"} para ${product.name}. Disponible: ${available}.`);
        }
        const newTotalUnits = product.totalUnits + (validated.type === "ENTRY" ? line.unitsCount : -line.unitsCount);
        const newBoxes = validated.type === "EXIT" && line.measure === "BOXES" ? product.boxes - line.quantity : validated.type === "ENTRY" && line.measure === "BOXES" ? product.boxes + line.quantity : product.boxes;
        const newLooseUnits = validated.type === "EXIT" && line.measure === "UNITS" ? product.looseUnits - line.quantity : validated.type === "ENTRY" && line.measure === "UNITS" ? product.looseUnits + line.quantity : product.looseUnits;
        await tx.warehouseProduct.update({
          where: { id: product.id },
          data: { boxes: newBoxes, looseUnits: newLooseUnits, totalUnits: newTotalUnits },
        });
        const movement = await tx.warehouseMovement.create({
          data: {
            productId: product.id,
            type: validated.type,
            boxesCount: line.boxesCount,
            totalUnits: line.unitsCount,
            reason: validated.reason,
            createdBy: user.name || user.email || user.id,
          },
          include: { product: true },
        });
        movements.push(movement);
        items.push({ product: movement.product, unitsCount: line.unitsCount, measure: line.measure, quantity: line.quantity });
      }
      return { id: movements[0]?.id, createdAt: movements[0]?.createdAt, type: validated.type, reason: validated.reason, items };
    });

    await logAudit({ userId: user.id, action: "warehouse_movement.bulk_create", module: "almacen", entityType: "warehouse_movement_batch", entityId: batch.id, afterData: { type: batch.type, itemCount: batch.items.length, totalUnits: batch.items.reduce((sum, item) => sum + item.unitsCount, 0) } });
    revalidatePath("/almacen");
    revalidatePath("/almacen/movimientos");
    return { success: true, data: batch, message: "Movimiento registrado correctamente" };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar el movimiento" };
  }
}

/**
 * Obtiene el historial de movimientos de almacÃ©n
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
    return { success: false, error: "Error al cargar movimientos de almacÃ©n", data: [] };
  }
}

/**
 * Genera un cÃ³digo correlativo para solicitudes (Ej. SOL-20260807-001)
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
 * Crea una solicitud de almacÃ©n / transferencias
 */
export async function createWarehouseRequestAction(input: WarehouseRequestInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesiÃ³n no tiene un usuario identificable." };
    const validated = warehouseRequestSchema.parse(input);
    if (validated.type === "EXIT") {
      const products = await prisma.warehouseProduct.findMany({ where: { id: { in: validated.items.map((item) => item.productId) } } });
      for (const item of validated.items) {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) return { success: false, error: "Uno de los productos seleccionados ya no existe." };
        const line = resolveMovementLine(item, product.unitsPerBox);
        const available = line.measure === "BOXES" ? product.boxes : product.looseUnits;
        if (available < line.quantity) return { success: false, error: `No hay suficientes ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"} de ${product.name}. Disponible: ${available}.` };
      }
    }
    const requestCode = await generateRequestCode();

    const created = await prisma.warehouseRequest.create({
      data: {
        requestCode,
        title: validated.title.trim(),
        branch: validated.branch,
        requestedBy: user.name || user.email || user.id,
        type: validated.type || "EXIT",
        status: "PENDING",
        details: JSON.stringify({
          reason: validated.details?.trim() || validated.title.trim(),
          items: Object.fromEntries(validated.items.map((item) => [item.productId, { measure: item.measure, quantity: item.quantity, unitsCount: item.unitsCount }]))
        }),
        items: { create: validated.items.map((item) => ({ productId: item.productId, unitsCount: item.unitsCount })) },
      },
      include: { items: true },
    });
    await logAudit({ userId: user.id, action: "warehouse_request.create", module: "almacen", entityType: "warehouse_request", entityId: created.id, afterData: { requestCode: created.requestCode, status: created.status } });

    revalidatePath("/almacen/transferencias");
    return { success: true, data: created, message: `Solicitud ${requestCode} registrada exitosamente` };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear la solicitud" };
  }
}

/**
 * Obtiene las solicitudes de almacÃ©n
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
      include: { items: { include: { product: { select: { id: true, code: true, name: true, brand: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: requests };
  } catch (error: any) {
    return { success: false, error: "Error al cargar solicitudes", data: [] };
  }
}

/**
 * Actualiza el estado de una solicitud de almacÃ©n (Aprobar / Rechazar)
 */
export async function updateWarehouseRequestStatusAction(id: string, status: "APPROVED" | "REJECTED") {
  try {
    const actor = await requireWarehouseAdmin();
    if (!actor.id) return { success: false, error: "La sesiÃ³n no tiene un usuario identificable." };
    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.warehouseRequest.findUnique({ where: { id }, include: { items: true } });
      if (!request) throw new Error("Solicitud no encontrada.");
      if (request.status !== "PENDING") throw new Error("Esta solicitud ya fue procesada.");
      if (status === "REJECTED") return tx.warehouseRequest.update({ where: { id }, data: { status } });
      const products = await tx.warehouseProduct.findMany({ where: { id: { in: request.items.map((item) => item.productId) } } });
      for (const item of request.items) {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) throw new Error("Uno de los productos de la solicitud ya no existe.");
        if (request.type === "EXIT" && product.totalUnits < item.unitsCount) throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.totalUnits} unidades.`);
      }
      for (const item of request.items) {
        const product = products.find((candidate) => candidate.id === item.productId)!;
        const nextTotal = request.type === "ENTRY" ? product.totalUnits + item.unitsCount : product.totalUnits - item.unitsCount;
        const nextLoose = request.type === "ENTRY" ? product.looseUnits + item.unitsCount : Math.max(0, product.looseUnits - item.unitsCount);
        await tx.warehouseProduct.update({ where: { id: product.id }, data: { totalUnits: nextTotal, looseUnits: nextLoose } });
        await tx.warehouseMovement.create({ data: { productId: product.id, type: request.type, boxesCount: 0, totalUnits: item.unitsCount, reason: `Solicitud ${request.requestCode}: ${request.title}`, createdBy: actor.id } });
      }
      return tx.warehouseRequest.update({ where: { id }, data: { status } });
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

