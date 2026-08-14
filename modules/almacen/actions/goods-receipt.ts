"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  goodsReceiptSchema,
  GoodsReceiptInput,
  goodsReceiptWarehouseImportSchema,
  GoodsReceiptWarehouseImportInput,
} from "@/lib/validation/goods-receipt";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";

/**
 * Genera un número de folio correlativo único (Ej: REC-20260807-001)
 */
/**
 * Auto-guarda nombres de modelos en el catálogo para autocompletado posterior
 */
async function autoIndexCatalogModels(descriptions: string[]) {
  try {
    for (const desc of descriptions) {
      const cleanName = desc.trim();
      if (!cleanName) continue;

      await prisma.catalogModel.upsert({
        where: { name: cleanName },
        update: {},
        create: { name: cleanName },
      });
    }
  } catch (err) {
    console.warn("Error al indexar modelos en catálogo:", err);
  }
}

/**
 * Obtiene sugerencias de modelos guardados para autocompletado
 */
export async function getCatalogModelsAction(search?: string) {
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

    return { success: true, data: models.map((m) => m.name) };
  } catch (err) {
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
    const modelNames = validated.items.map((i) => i.description);
    await autoIndexCatalogModels(modelNames);

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
              items: {
                create: validated.items.map((item) => ({
                  code: item.code || null,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice ?? null,
                  condition: item.condition || "Nuevo",
                  imeiOrSerial: item.imeiOrSerial || null,
                  colorVariants: item.colorVariants ? (item.colorVariants as any) : null,
                  notes: item.notes || null,
                })),
              },
            },
            include: {
              items: true,
            },
          });
        });
        await logAudit({ userId: user.id, action: "goods_receipt.update", module: "almacen", entityType: "goods_receipt", entityId: updated.id, afterData: { receiptNumber: updated.receiptNumber, status: updated.status, itemCount: updated.items.length } });

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
        items: {
          create: validated.items.map((item) => ({
            code: item.code || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
            condition: item.condition || "Nuevo",
            imeiOrSerial: item.imeiOrSerial || null,
            colorVariants: item.colorVariants ? (item.colorVariants as any) : null,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true },
      });
    });
    await logAudit({ userId: user.id, action: "goods_receipt.create", module: "almacen", entityType: "goods_receipt", entityId: created.id, afterData: { receiptNumber: created.receiptNumber, status: created.status, itemCount: created.items.length } });

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
      },
      orderBy: {
        createdAt: "desc",
      },
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

      const products = [];
      for (const line of validated.lines) {
        const code = line.code.toUpperCase();
        const existing = await tx.warehouseProduct.findUnique({ where: { code } });
        const unitsPerBox = existing?.unitsPerBox || line.unitsPerBox;
        const boxes = Math.floor(line.quantity / unitsPerBox);
        const looseUnits = line.quantity % unitsPerBox;
        const product = existing
          ? await tx.warehouseProduct.update({ where: { id: existing.id }, data: { name: line.name, brand: line.brand || null, capacity: line.capacity || null, color: line.color, boxes: { increment: boxes }, looseUnits: { increment: looseUnits }, totalUnits: { increment: line.quantity } } })
          : await tx.warehouseProduct.create({ data: { code, name: line.name, brand: line.brand || null, capacity: line.capacity || null, color: line.color, boxes, unitsPerBox: line.unitsPerBox, looseUnits, totalUnits: line.quantity } });
        await tx.warehouseMovement.create({ data: { productId: product.id, type: "ENTRY", boxesCount: boxes, totalUnits: line.quantity, reason: `Importación recibo ${receipt.receiptNumber}`, createdBy: actor.id } });
        await tx.goodsReceiptItem.update({ where: { id: line.itemId }, data: { code } });
        products.push(product);
      }
      return products;
    });

    await logAudit({ userId: actor.id, action: "goods_receipt.import_to_warehouse", module: "almacen", entityType: "goods_receipt", entityId: receipt.id, afterData: { receiptNumber: receipt.receiptNumber, productIds: created.map((product) => product.id), lineCount: created.length } });
    revalidatePath("/almacen");
    revalidatePath("/almacen/recibos");
    revalidatePath("/dashboard");
    return { success: true, data: created, message: `${created.length} producto(s) enviado(s) al almacén. Los códigos quedaron guardados en el recibo.` };
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
