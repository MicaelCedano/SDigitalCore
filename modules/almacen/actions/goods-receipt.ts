"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import {
  goodsReceiptSchema,
  GoodsReceiptInput,
} from "@/lib/validation/goods-receipt";

/**
 * Genera un número de folio correlativo único (Ej: REC-20260807-001)
 */
async function generateReceiptNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `REC-${dateStr}-`;

  const countToday = await prisma.goodsReceipt.count({
    where: {
      receiptNumber: {
        startsWith: prefix,
      },
    },
  });

  const nextNum = (countToday + 1).toString().padStart(3, "0");
  return `${prefix}${nextNum}`;
}

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
    const user = await getCurrentUser();
    const validated = goodsReceiptSchema.parse(input);

    const receivedBy = validated.receivedBy || user?.name || user?.email || "Usuario del Sistema";

    // Auto-indexar los modelos registrados para sugerencias futuras
    const modelNames = validated.items.map((i) => i.description);
    await autoIndexCatalogModels(modelNames);

    // Si ya tiene ID, actualizamos
    if (validated.id) {
      const existing = await prisma.goodsReceipt.findUnique({
        where: { id: validated.id },
      });

      if (existing) {
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

        revalidatePath("/almacen/recibos");
        return { success: true, data: updated, message: "Recibo actualizado exitosamente" };
      }
    }

    // Crear nuevo recibo
    const receiptNumber = await generateReceiptNumber();

    const created = await prisma.goodsReceipt.create({
      data: {
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
      include: {
        items: true,
      },
    });

    revalidatePath("/almacen/recibos");
    return { success: true, data: created, message: `Recibo ${receiptNumber} registrado exitosamente` };
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

/**
 * Elimina o anula un recibo de mercancía
 */
export async function deleteGoodsReceiptAction(id: string) {
  try {
    await prisma.goodsReceipt.delete({
      where: { id },
    });

    revalidatePath("/almacen/recibos");
    return { success: true, message: "Recibo eliminado correctamente" };
  } catch (error: any) {
    return { success: false, error: "Error al eliminar el recibo" };
  }
}
