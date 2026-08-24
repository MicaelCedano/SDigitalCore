"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { sendPushToRole } from "@/lib/mobile/push";
import { revalidatePath } from "next/cache";
import {
  goodsReceiptSchema,
  GoodsReceiptInput,
  goodsReceiptWarehouseImportSchema,
  GoodsReceiptWarehouseImportInput,
} from "@/lib/validation/goods-receipt";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Genera un número de folio correlativo único (Ej: REC-20260807-001)
 */
/**
 * Auto-guarda nombres de modelos en el catálogo para autocompletado posterior
 */
function normalizeReceiptText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizedKey(value: string | null | undefined) {
  return normalizeReceiptText(value).toLocaleLowerCase("es");
}

function normalizedColorKey(value: string | null | undefined) {
  const key = normalizedKey(value).replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    black: "black", negro: "black",
    gray: "gray", grey: "gray", gris: "gray",
    white: "white", blanco: "white",
    blue: "blue", azul: "blue",
    green: "green", verde: "green",
    orange: "orange", naranja: "orange",
    red: "red", rojo: "red",
    purple: "purple", morado: "purple", violeta: "purple", violet: "purple",
    pink: "pink", rosado: "pink", rosa: "pink",
    gold: "gold", dorado: "gold",
    silver: "silver", plateado: "silver",
  };
  return aliases[key] || key;
}

const warehouseProductIdentitySchema = z.object({
  brand: z.string().trim().min(1),
  name: z.string().trim().min(1),
  capacity: z.string().trim().optional().default(""),
  color: z.string().trim().optional().default(""),
});

async function autoIndexCatalogModels(models: string[]) {
  try {
    const seen = new Set<string>();
    for (const model of models) {
      const cleanName = normalizeReceiptText(model);
      const key = normalizedKey(cleanName);
      if (!cleanName || seen.has(key)) continue;
      seen.add(key);
      const existing = await prisma.catalogModel.findFirst({
        where: { name: { equals: cleanName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) continue;
      try {
        await prisma.catalogModel.create({ data: { name: cleanName } });
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
      }
    }
  } catch (err) {
    console.warn("Error al indexar modelos en catálogo:", err);
  }
}

/**
 * Obtiene sugerencias de modelos guardados para autocompletado
 */
export async function getCatalogModelsAction(search?: string, brand?: string) {
  try {
    await requirePermission("warehouse.read");
    const where = search && search.trim() !== ""
      ? { name: { contains: search.trim(), mode: "insensitive" as const } }
      : {};

    const models = await prisma.catalogModel.findMany({
      where,
      orderBy: { name: "asc" },
      take: 20,
    });

    if (!brand?.trim()) return { success: true, data: models.map((m) => m.name) };

    const receipts = await prisma.goodsReceipt.findMany({
      select: { items: { select: { description: true, colorVariants: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const brandKey = normalizedKey(brand);
    const brandModels = new Set<string>();
    for (const receipt of receipts) {
      for (const item of receipt.items) {
        const variant = Array.isArray(item.colorVariants) ? item.colorVariants[0] as Record<string, unknown> | undefined : undefined;
        const itemBrand = typeof variant?.brand === "string" ? variant.brand : "";
        const itemModel = typeof variant?.model === "string" ? variant.model : item.description;
        if (normalizedKey(itemBrand) === brandKey && normalizeReceiptText(itemModel)) brandModels.add(normalizeReceiptText(itemModel));
      }
    }
    return { success: true, data: models.map((m) => m.name).filter((name) => brandModels.size === 0 || brandModels.has(normalizeReceiptText(name))) };
  } catch {
    return { success: false, data: [] };
  }
}

/**
 * Crea o guarda un recibo de mercancía (Borrador o Completado)
 */
export async function saveGoodsReceiptAction(input: GoodsReceiptInput) {
  try {
    const user = await requirePermission("warehouse.write");
    if (!user.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const validated = goodsReceiptSchema.parse(input);
    const branchExists = await prisma.branch.findFirst({ where: { name: validated.branch, status: "ACTIVE" }, select: { id: true } });
    if (!branchExists) return { success: false, error: "La sucursal seleccionada no existe o está inactiva." };
    const receivedBy = user.name || user.email || user.id;

    // Auto-indexar los modelos registrados para sugerencias futuras
    const modelNames = validated.items.map((i) => normalizeReceiptText(i.model || i.description));
    await autoIndexCatalogModels(modelNames);

    const persistItem = (item: GoodsReceiptInput["items"][number]) => {
      const model = normalizeReceiptText(item.model || item.description);
      const brand = normalizeReceiptText(item.brand);
      const capacity = normalizeReceiptText(item.capacity);
      return {
        code: normalizeReceiptText(item.code) || null,
        // Keep the legacy column for observations, while older records still
        // use it as the model and remain importable through the fallback.
        description: normalizeReceiptText(item.description),
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
        condition: item.condition || "Nuevo",
        imeiOrSerial: normalizeReceiptText(item.imeiOrSerial) || null,
        colorVariants: item.colorVariants?.map((variant) => ({
          ...variant,
          brand: brand || null,
          model: model || null,
          capacity: capacity || null,
          color: normalizeReceiptText(variant.color) || null,
          imeis: normalizeReceiptText(variant.imeis) || null,
        })) as Prisma.InputJsonValue ?? null,
        notes: normalizeReceiptText(item.notes) || null,
      };
    };

    // Si ya tiene ID, actualizamos
    if (validated.id) {
      const existing = await prisma.goodsReceipt.findUnique({
        where: { id: validated.id },
      });

      if (existing) {
        if (existing.status !== "DRAFT") {
          return { success: false, error: "Solo los recibos en borrador pueden modificarse." };
        }
        const updated = await prisma.$transaction(async (tx) => {
          await tx.goodsReceiptItem.deleteMany({
            where: { receiptId: validated.id },
          });

          return tx.goodsReceipt.update({
            where: { id: validated.id },
            data: {
              supplierName: validated.supplierName,
              branch: validated.branch,
              receivedBy: receivedBy,
              status: validated.status,
              notes: validated.notes,
              items: { create: validated.items.map(persistItem) },
            },
            include: {
              items: true,
            },
          });
        });
        await logAudit({ userId: user.id, action: "goods_receipt.update", module: "almacen", entityType: "goods_receipt", entityId: updated.id, afterData: { receiptNumber: updated.receiptNumber, status: updated.status, itemCount: updated.items.length } });
        if (updated.status === "COMPLETED") {
          await sendPushToRole("ADMIN", {
            title: `Recibo ${updated.receiptNumber} completado`,
            body: `${updated.supplierName} · ${updated.items.length} línea(s) recibida(s).`,
            route: "/almacen/recibos",
            type: "goods_receipt.completed",
          });
        }

        revalidatePath("/almacen/recibos");
        revalidatePath("/dashboard");
        revalidatePath("/", "layout");
        return { success: true, data: updated, message: "Recibo actualizado exitosamente" };
      }
    }

    // Crear nuevo recibo
    const created = await prisma.$transaction(async (tx) => {
      const receiptNumber = await nextOperationalNumber(tx, "GOODS_RECEIPT", "REC");
      return tx.goodsReceipt.create({ data: {
        receiptNumber,
        supplierName: validated.supplierName,
        branch: validated.branch,
        receivedBy: receivedBy,
        status: validated.status,
        notes: validated.notes,
        items: { create: validated.items.map(persistItem) },
      },
      include: { items: true },
      });
    });
    await logAudit({ userId: user.id, action: "goods_receipt.create", module: "almacen", entityType: "goods_receipt", entityId: created.id, afterData: { receiptNumber: created.receiptNumber, status: created.status, itemCount: created.items.length } });
    if (created.status === "COMPLETED") {
      await sendPushToRole("ADMIN", {
        title: `Recibo ${created.receiptNumber} completado`,
        body: `${created.supplierName} · ${created.items.length} línea(s) recibida(s).`,
        route: "/almacen/recibos",
        type: "goods_receipt.completed",
      });
    }

    revalidatePath("/almacen/recibos");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true, data: created, message: `Recibo ${created.receiptNumber} registrado exitosamente` };
  } catch (error: any) {
    console.error("Error al guardar recibo de mercancía:", error);
    return {
      success: false,
      error: error.message || "Error al procesar el recibo de mercancía",
    };
  }
}

/**
 * Obtiene la lista de recibos de mercancía con filtros de búsqueda
 */
export async function getGoodsReceiptsAction(query?: string, status?: string) {
  try {
    await requirePermission("warehouse.read");
    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { receiptNumber: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { receivedBy: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { description: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { imeiOrSerial: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where,
      include: {
        items: true,
        warehouseImports: {
          orderBy: { importedAt: "desc" },
          take: 1,
          include: { lines: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return { success: true, data: receipts };
  } catch (error: any) {
    console.error("Error al consultar recibos:", error);
    return { success: false, error: "Error al obtener los recibos de mercancía", data: [] };
  }
}

/**
 * Obtiene el detalle completo de un recibo por su ID
 */
export async function getGoodsReceiptByIdAction(id: string) {
  try {
    await requirePermission("warehouse.read");
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        items: true,
        warehouseImports: {
          orderBy: { importedAt: "desc" },
          take: 1,
          include: { lines: true },
        },
      },
    });

    if (!receipt) {
      return { success: false, error: "Recibo no encontrado" };
    }

    return { success: true, data: receipt };
  } catch (error: any) {
    return { success: false, error: "Error al cargar el recibo" };
  }
}

export async function getWarehouseProductSuggestionAction(input: unknown) {
  try {
    await requirePermission("warehouse.read");
    const identity = warehouseProductIdentitySchema.parse(input);
    const candidates = await prisma.warehouseProduct.findMany({
      where: {
        status: "ACTIVE",
        brand: { equals: identity.brand, mode: "insensitive" },
        name: { equals: identity.name, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    const matches = candidates.filter((product) =>
      normalizedKey(product.capacity) === normalizedKey(identity.capacity) &&
      normalizedColorKey(product.color) === normalizedColorKey(identity.color),
    );
    if (matches.length !== 1) return { success: true, data: null, matchCount: matches.length };
    const product = matches[0];
    return {
      success: true,
      data: {
        code: product.code,
        unitsPerBox: product.unitsPerBox,
        boxes: product.boxes,
        looseUnits: product.looseUnits,
        totalUnits: product.totalUnits,
      },
      matchCount: 1,
    };
  } catch (error) {
    console.error("Error al buscar producto existente para importar recibo:", error);
    return { success: false, data: null, matchCount: 0 };
  }
}

export async function getGoodsReceiptSuggestionsAction(brand?: string) {
  try {
    await requirePermission("warehouse.read");
    const receipts = await prisma.goodsReceipt.findMany({
      select: { supplierName: true, items: { select: { description: true, colorVariants: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const suppliers = new Map<string, string>();
    const colors = new Map<string, string>();
    const models = new Map<string, { model: string; brand: string; capacity: string }>();
    const brandKey = normalizedKey(brand);
    for (const receipt of receipts) {
      const supplier = normalizeReceiptText(receipt.supplierName);
      if (supplier) suppliers.set(normalizedKey(supplier), supplier);
      for (const item of receipt.items) {
        const variants = Array.isArray(item.colorVariants) ? item.colorVariants : [];
        for (const rawVariant of variants) {
          const variant = rawVariant as Record<string, unknown>;
          const color = normalizeReceiptText(typeof variant.color === "string" ? variant.color : "");
          if (color && normalizedKey(color) !== "general") colors.set(normalizedKey(color), color);
          const model = normalizeReceiptText(typeof variant.model === "string" ? variant.model : item.description);
          const itemBrand = normalizeReceiptText(typeof variant.brand === "string" ? variant.brand : "");
          const capacity = normalizeReceiptText(typeof variant.capacity === "string" ? variant.capacity : "");
          if (model && (!brandKey || normalizedKey(itemBrand) === brandKey)) models.set(`${normalizedKey(itemBrand)}|${normalizedKey(model)}|${normalizedKey(capacity)}`, { model, brand: itemBrand, capacity });
        }
      }
    }
    return {
      success: true,
      data: {
        suppliers: [...suppliers.values()].sort((a, b) => a.localeCompare(b, "es")),
        colors: [...colors.values()].sort((a, b) => a.localeCompare(b, "es")),
        models: [...models.values()].sort((a, b) => a.model.localeCompare(b.model, "es")),
      },
    };
  } catch (error) {
    console.error("Error al obtener sugerencias de recibos:", error);
    return { success: false, data: { suppliers: [], colors: [], models: [] } };
  }
}

export async function importGoodsReceiptToWarehouseAction(input: GoodsReceiptWarehouseImportInput) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const persisted = await prisma.user.findUnique({ where: { id: actor.id }, select: { roleCode: true } });
    if (persisted?.roleCode !== "ADMIN") return { success: false, error: "Solo un administrador puede importar productos al almacén." };

    const validated = goodsReceiptWarehouseImportSchema.parse(input);
    const receipt = await prisma.goodsReceipt.findUnique({ where: { id: validated.receiptId }, include: { items: true } });
    if (!receipt) return { success: false, error: "Recibo no encontrado." };
    if (receipt.status !== "COMPLETED") return { success: false, error: "Solo puedes importar recibos completados." };
    if (receipt.warehouseImportedAt) return { success: false, error: `El recibo ${receipt.receiptNumber} ya fue enviado al almacén y no puede enviarse otra vez.` };
    const receiptItemIds = new Set(receipt.items.map((item) => item.id));
    if (validated.lines.some((line) => !receiptItemIds.has(line.itemId))) return { success: false, error: "Una de las líneas no pertenece a este recibo." };

    const codes = validated.lines.map((line) => line.code.toUpperCase());
    if (new Set(codes).size !== codes.length) return { success: false, error: "Cada modelo/color debe tener un código Kaptas diferente." };
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.goodsReceipt.updateMany({
        where: { id: receipt.id, status: "COMPLETED", warehouseImportedAt: null },
        data: { warehouseImportedAt: new Date(), warehouseImportedBy: actor.id },
      });
      if (claimed.count !== 1) throw new Error(`El recibo ${receipt.receiptNumber} ya fue enviado al almacén y no puede enviarse otra vez.`);

      const importNumber = await nextOperationalNumber(tx, "WAREHOUSE_RECEIPT_IMPORT", "ENT");
      const products = [];
      const importLines: Array<{
        productId: string;
        itemId: string;
        code: string;
        name: string;
        brand: string | null;
        capacity: string | null;
        color: string | null;
        unitsPerBox: number;
        boxesCount: number;
        looseUnits: number;
        totalUnits: number;
      }> = [];
      for (const line of validated.lines) {
        const code = line.code.toUpperCase();
        const existing = await tx.warehouseProduct.findUnique({ where: { code } });
        const unitsPerBox = existing?.unitsPerBox || line.unitsPerBox;
        const boxes = Math.floor(line.quantity / unitsPerBox);
        const looseUnits = line.quantity % unitsPerBox;
        const product = existing
          ? await tx.warehouseProduct.update({ where: { id: existing.id }, data: { name: line.name, brand: line.brand || null, capacity: line.capacity || null, color: line.color || null, boxes: { increment: boxes }, looseUnits: { increment: looseUnits }, totalUnits: { increment: line.quantity } } })
          : await tx.warehouseProduct.create({ data: { code, name: line.name, brand: line.brand || null, capacity: line.capacity || null, color: line.color || null, boxes, unitsPerBox: line.unitsPerBox, looseUnits, totalUnits: line.quantity } });
        await tx.warehouseMovement.create({ data: { productId: product.id, type: "ENTRY", boxesCount: boxes, totalUnits: line.quantity, reason: `Entrada ${importNumber} · recibo ${receipt.receiptNumber}`, createdBy: actor.id } });
        await tx.goodsReceiptItem.update({ where: { id: line.itemId }, data: { code } });
        importLines.push({ productId: product.id, itemId: line.itemId, code, name: line.name, brand: line.brand || null, capacity: line.capacity || null, color: line.color || null, unitsPerBox, boxesCount: boxes, looseUnits, totalUnits: line.quantity });
        products.push(product);
      }
      const voucher = await tx.warehouseReceiptImport.create({
        data: {
          importNumber,
          receiptId: receipt.id,
          importedBy: actor.id,
          lines: { create: importLines },
        },
        include: { lines: true },
      });
      return { products, voucher };
    });

    await logAudit({ userId: actor.id, action: "goods_receipt.import_to_warehouse", module: "almacen", entityType: "goods_receipt", entityId: receipt.id, afterData: { receiptNumber: receipt.receiptNumber, importNumber: created.voucher.importNumber, productIds: created.products.map((product) => product.id), lineCount: created.products.length } });
    revalidatePath("/almacen");
    revalidatePath("/almacen/recibos");
    revalidatePath("/dashboard");
    return { success: true, data: created.products, importNumber: created.voucher.importNumber, message: `${created.products.length} producto(s) enviado(s) al almacén. Comprobante ${created.voucher.importNumber} generado.` };
  } catch (error: any) {
    console.error("Error al importar recibo al almacén:", error);
    return { success: false, error: error.message || "No se pudo importar el recibo al almacén." };
  }
}

/**
 * Elimina o anula un recibo de mercancía
 */
export async function deleteGoodsReceiptAction(id: string) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const existing = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Recibo no encontrado" };
    if (existing.status === "CANCELLED") return { success: false, error: "El recibo ya está anulado" };
    if (existing.warehouseImportedAt) return { success: false, error: "Primero cancela la entrada al almacén desde el comprobante; así el stock queda correcto." };
    const cancelled = await prisma.goodsReceipt.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({ userId: actor.id, action: "goods_receipt.cancel", module: "almacen", entityType: "goods_receipt", entityId: cancelled.id, beforeData: { receiptNumber: existing.receiptNumber, status: existing.status }, afterData: { status: cancelled.status } });

    revalidatePath("/almacen/recibos");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true, message: "Recibo anulado; su historial fue conservado" };
  } catch (error: any) {
    return { success: false, error: "Error al anular el recibo" };
  }
}

export async function cancelGoodsReceiptWarehouseImportAction(importId: string) {
  try {
    const actor = await requirePermission("warehouse.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };
    const persisted = await prisma.user.findUnique({ where: { id: actor.id }, select: { roleCode: true } });
    if (persisted?.roleCode !== "ADMIN") return { success: false, error: "Solo un administrador puede cancelar una entrada al almacén." };

    const imported = await prisma.warehouseReceiptImport.findUnique({
      where: { id: importId },
      include: { receipt: true, lines: true },
    });
    if (!imported) return { success: false, error: "Comprobante de almacén no encontrado." };
    if (imported.status !== "ACTIVE") return { success: false, error: "Este comprobante ya fue cancelado." };

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.warehouseReceiptImport.updateMany({
        where: { id: imported.id, status: "ACTIVE" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor.id },
      });
      if (claimed.count !== 1) throw new Error("Este comprobante ya fue cancelado por otra operación.");
      for (const line of imported.lines) {
        const changed = await tx.warehouseProduct.updateMany({
          where: {
            id: line.productId,
            status: "ACTIVE",
            boxes: { gte: line.boxesCount },
            looseUnits: { gte: line.looseUnits },
            totalUnits: { gte: line.totalUnits },
          },
          data: {
            boxes: { decrement: line.boxesCount },
            looseUnits: { decrement: line.looseUnits },
            totalUnits: { decrement: line.totalUnits },
          },
        });
        if (changed.count !== 1) throw new Error(`No se puede cancelar ${imported.importNumber}: el stock de ${line.code} ya fue utilizado o cambió.`);
        await tx.warehouseMovement.create({ data: { productId: line.productId, type: "EXIT", boxesCount: line.boxesCount, totalUnits: line.totalUnits, reason: `Cancelación ${imported.importNumber} · recibo ${imported.receipt.receiptNumber}`, createdBy: actor.id } });
      }
      await tx.goodsReceipt.update({ where: { id: imported.receiptId }, data: { warehouseImportedAt: null, warehouseImportedBy: null } });
    });

    await logAudit({ userId: actor.id, action: "goods_receipt.warehouse_import_cancel", module: "almacen", entityType: "warehouse_receipt_import", entityId: imported.id, beforeData: { importNumber: imported.importNumber, receiptNumber: imported.receipt.receiptNumber, status: imported.status }, afterData: { status: "CANCELLED", stockReversed: true } });
    revalidatePath("/almacen");
    revalidatePath("/almacen/recibos");
    revalidatePath("/dashboard");
    return { success: true, message: `Entrada ${imported.importNumber} cancelada y stock revertido.` };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo cancelar la entrada al almacén." };
  }
}

