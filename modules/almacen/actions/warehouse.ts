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
import { nextOperationalNumber } from "@/lib/db/daily-sequence";
import type { Prisma } from "@prisma/client";

const legacyWarehouseProductSelect = {
  id: true,
  code: true,
  name: true,
  brand: true,
  color: true,
  capacity: true,
  description: true,
  boxes: true,
  unitsPerBox: true,
  looseUnits: true,
  totalUnits: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WarehouseProductSelect;

async function requireWarehouseAdmin() {
  const actor = await requirePermission("warehouse.read");
  const persisted = await prisma.user.findUnique({ where: { id: actor.id }, select: { roleCode: true } });
  if (persisted?.roleCode !== "ADMIN") throw new Error("Solo un administrador puede gestionar movimientos y solicitudes.");
  return actor;
}

function resolveMovementLine(item: { unitsCount: number; measure?: "BOXES" | "UNITS"; quantity?: number }, unitsPerBox: number) {
  const measure: "BOXES" | "UNITS" = item.measure === "BOXES" ? "BOXES" : "UNITS";
  const quantity = Math.max(1, Number(item.quantity) || (measure === "BOXES" ? Math.ceil(item.unitsCount / Math.max(1, unitsPerBox)) : item.unitsCount));
  return {
    measure,
    quantity,
    unitsCount: measure === "BOXES" ? quantity * Math.max(1, unitsPerBox) : quantity,
    boxesCount: measure === "BOXES" ? quantity : 0,
  };
}

async function applyStockDelta(
  tx: Prisma.TransactionClient,
  productId: string,
  type: "ENTRY" | "EXIT",
  line: { measure: "BOXES" | "UNITS"; quantity: number; unitsCount: number },
) {
  const direction = type === "ENTRY" ? 1 : -1;
  const changed = await tx.warehouseProduct.updateMany({
    where: {
      id: productId,
      status: "ACTIVE",
      ...(type === "EXIT"
        ? line.measure === "BOXES"
          ? { boxes: { gte: line.quantity }, totalUnits: { gte: line.unitsCount } }
          : { looseUnits: { gte: line.quantity }, totalUnits: { gte: line.unitsCount } }
        : {}),
    },
    data: {
      boxes: { increment: line.measure === "BOXES" ? direction * line.quantity : 0 },
      looseUnits: { increment: line.measure === "UNITS" ? direction * line.quantity : 0 },
      totalUnits: { increment: direction * line.unitsCount },
    },
  });
  if (changed.count !== 1) throw new Error("El producto ya no está activo o su stock disponible cambió. Actualiza e intenta de nuevo.");
  return tx.warehouseProduct.findUniqueOrThrow({ where: { id: productId } });
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
 * Obtiene la lista de productos de almacén con sus cajas y unidades totales
 */
export async function getWarehouseProductsAction(query?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: Prisma.WarehouseProductWhereInput = { status: "ACTIVE" };
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
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: { modelName?: string } };
    const missingStatusColumn =
      prismaError.code === "P2022" && prismaError.meta?.modelName === "WarehouseProduct";

    if (missingStatusColumn) {
      const legacyWhere: Prisma.WarehouseProductWhereInput = {};
      if (query && query.trim() !== "") {
        const q = query.trim();
        legacyWhere.OR = [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { color: { contains: q, mode: "insensitive" } },
          { capacity: { contains: q, mode: "insensitive" } },
        ];
      }

      const products = await prisma.warehouseProduct.findMany({
        where: legacyWhere,
        orderBy: { createdAt: "desc" },
        select: legacyWarehouseProductSelect,
      });

      return {
        success: true,
        data: products.map((product) => ({ ...product, status: "ACTIVE" })),
      };
    }

    console.error("Error al cargar productos de almacén", error);
    return { success: false, error: "Error al cargar productos de almacén", data: [] };
  }
}

/**
 * Crea o actualiza un producto en almacén
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
        select: legacyWarehouseProductSelect,
      });
      await logAudit({ userId: actor.id, action: "warehouse_product.update", module: "almacen", entityType: "warehouse_product", entityId: updated.id, afterData: { code: updated.code, name: updated.name, boxes: updated.boxes, looseUnits: updated.looseUnits, totalUnits: updated.totalUnits } });

      revalidatePath("/almacen");
      return { success: true, data: { ...updated, status: "ACTIVE" }, message: "Producto actualizado exitosamente" };
    }

    // Verificar código duplicado
    const existing = await prisma.warehouseProduct.findUnique({
      where: { code: validated.code.toUpperCase().trim() },
      select: { id: true },
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
        looseUnits,
        totalUnits,
      },
      select: legacyWarehouseProductSelect,
    });
    await logAudit({ userId: actor.id, action: "warehouse_product.create", module: "almacen", entityType: "warehouse_product", entityId: created.id, afterData: { code: created.code, name: created.name, boxes: created.boxes, looseUnits: created.looseUnits, totalUnits: created.totalUnits } });

    revalidatePath("/almacen");
      return { success: true, data: { ...created, status: "ACTIVE" }, message: "Producto de almacén registrado exitosamente" };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar producto" };
  }
}

/**
 * Elimina un producto de almacén
 */
export async function deleteWarehouseProductAction(id: string) {
  try {
    const actor = await requireWarehouseAdmin();
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const archived = await prisma.warehouseProduct.update({ where: { id }, data: { status: "INACTIVE" } });
    await logAudit({ userId: actor.id, action: "warehouse_product.archive", module: "almacen", entityType: "warehouse_product", entityId: archived.id, beforeData: { code: archived.code, name: archived.name }, afterData: { status: archived.status } });

    revalidatePath("/almacen");
    return { success: true, message: "Producto archivado; sus movimientos fueron conservados" };
  } catch (error: any) {
    return { success: false, error: "Error al archivar el producto" };
  }
}

/**
 * Registra un movimiento de Entradas / Salidas de Almacén y recalcula cajas/unidades
 */
export async function createWarehouseMovementAction(input: WarehouseMovementInput) {
  try {
    const user = await requireWarehouseAdmin();
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseMovementSchema.parse(input);
    const product = await prisma.warehouseProduct.findFirst({
      where: { id: validated.productId, status: "ACTIVE" },
    });

    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }

    const line = resolveMovementLine(validated, product.unitsPerBox);
    const available = line.measure === "BOXES" ? product.boxes : product.looseUnits;
    if (validated.type === "EXIT" && available < line.quantity) {
      return { success: false, error: `Stock insuficiente en ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"}. Disponible: ${available}, solicitado: ${line.quantity}` };
    }

    const movement = await prisma.$transaction(async (tx) => {
      await applyStockDelta(tx, product.id, validated.type, line);

    // 2. Registrar movimiento en la bitácora
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

/** Registra una entrada o salida con varios modelos en una sola operación. */
export async function createWarehouseMovementsBulkAction(input: WarehouseBulkMovementInput) {
  try {
    const user = await requireWarehouseAdmin();
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseBulkMovementSchema.parse(input);
    const ids = validated.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) return { success: false, error: "No repita el mismo producto en el movimiento." };

    const batch = await prisma.$transaction(async (tx) => {
      const products = await tx.warehouseProduct.findMany({ where: { id: { in: ids }, status: "ACTIVE" } });
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
        await applyStockDelta(tx, product.id, validated.type, line);
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
 * Obtiene el historial de movimientos de almacén
 */
export async function getWarehouseMovementsAction(query?: string) {
  try {
    await requireWarehouseAdmin();
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
/**
 * Crea una solicitud de almacén / transferencias
 */
export async function createWarehouseRequestAction(input: WarehouseRequestInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = warehouseRequestSchema.parse(input);
    if (validated.type === "EXIT") {
      const products = await prisma.warehouseProduct.findMany({ where: { id: { in: validated.items.map((item) => item.productId) }, status: "ACTIVE" } });
      for (const item of validated.items) {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) return { success: false, error: "Uno de los productos seleccionados ya no existe." };
        const line = resolveMovementLine(item, product.unitsPerBox);
        const available = line.measure === "BOXES" ? product.boxes : product.looseUnits;
        if (available < line.quantity) return { success: false, error: `No hay suficientes ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"} de ${product.name}. Disponible: ${available}.` };
      }
    }
    const created = await prisma.$transaction(async (tx) => {
      const requestCode = await nextOperationalNumber(tx, "WAREHOUSE_REQUEST", "SOL");
      return tx.warehouseRequest.create({ data: {
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
    });
    await logAudit({ userId: user.id, action: "warehouse_request.create", module: "almacen", entityType: "warehouse_request", entityId: created.id, afterData: { requestCode: created.requestCode, status: created.status } });

    revalidatePath("/almacen/transferencias");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true, data: created, message: `Solicitud ${created.requestCode} registrada exitosamente` };
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
      include: { items: { include: { product: { select: { id: true, code: true, name: true, brand: true, capacity: true, color: true, unitsPerBox: true } } } } },
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
    const actor = await requireWarehouseAdmin();
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.warehouseRequest.findUnique({ where: { id }, include: { items: true } });
      if (!request) throw new Error("Solicitud no encontrada.");
      if (request.status !== "PENDING") throw new Error("Esta solicitud ya fue procesada.");
      if (status === "REJECTED") return tx.warehouseRequest.update({ where: { id }, data: { status } });
      const products = await tx.warehouseProduct.findMany({ where: { id: { in: request.items.map((item) => item.productId) }, status: "ACTIVE" } });
      for (const item of request.items) {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) throw new Error("Uno de los productos de la solicitud ya no existe.");
        const savedLine = parseRequestLine(request.details, item.productId, item.unitsCount);
        const line = resolveMovementLine({ unitsCount: item.unitsCount, ...savedLine }, product.unitsPerBox);
        await applyStockDelta(tx, product.id, request.type, line);
        await tx.warehouseMovement.create({ data: { productId: product.id, type: request.type, boxesCount: line.boxesCount, totalUnits: line.unitsCount, reason: `Solicitud ${request.requestCode}: ${request.title}`, createdBy: actor.id } });
      }
      return tx.warehouseRequest.update({ where: { id }, data: { status } });
    });
    await logAudit({ userId: actor.id, action: "warehouse_request.status.update", module: "almacen", entityType: "warehouse_request", entityId: updated.id, afterData: { status: updated.status } });

    revalidatePath("/almacen/transferencias");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return {
      success: true,
      data: updated,
      message: `Solicitud ${status === "APPROVED" ? "Aprobada" : "Rechazada"}`,
    };
  } catch (error: any) {
    return { success: false, error: "Error al actualizar la solicitud" };
  }
}

