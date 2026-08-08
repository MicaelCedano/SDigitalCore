"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import {
  priceListBrandOrderSchema,
  priceListBrandSchema,
  priceListItemSchema,
  priceListOrderSchema,
  type PriceListBrandInput,
  type PriceListItemInput,
} from "@/lib/validation/price-list";

const modulePath = "/precios";

async function ensureBrands() {
  const brands = await prisma.priceListBrand.findMany({ orderBy: { orderIndex: "asc" } });
  if (brands.length) return brands;

  const existing = await prisma.priceListItem.findMany({
    where: { status: "ACTIVE", brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });

  if (!existing.length) return [];
  await prisma.priceListBrand.createMany({
    data: existing.flatMap((item, index) => item.brand ? [{ name: item.brand, orderIndex: index }] : []),
    skipDuplicates: true,
  });
  return prisma.priceListBrand.findMany({ orderBy: { orderIndex: "asc" } });
}

export async function getPriceListWorkspaceAction(query = "") {
  try {
    await requireUser();
    const brands = await ensureBrands();
    const term = query.trim();
    const inventory = await prisma.priceListItem.findMany({
      where: {
        status: "ACTIVE",
        ...(term ? {
          OR: [
            { brand: { contains: term, mode: "insensitive" } },
            { model: { contains: term, mode: "insensitive" } },
            { capacity: { contains: term, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    });
    const activeList = await prisma.priceListItem.findMany({
      where: { status: "ACTIVE", isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    const logoSetting = await prisma.priceListSetting.findUnique({ where: { key: "logo" } });
    return { success: true, data: { brands, inventory, activeList, logo: typeof logoSetting?.value === "string" ? logoSetting.value : null } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo cargar la lista de precios" };
  }
}

export async function savePriceListItemAction(input: PriceListItemInput) {
  try {
    const user = await requirePermission("precios.write");
    const validated = priceListItemSchema.parse(input);
    const data = {
      sku: validated.sku?.trim().toUpperCase() || null,
      model: validated.model.trim().toUpperCase(),
      category: validated.category,
      brand: validated.brand?.trim().toUpperCase() || null,
      capacity: validated.capacity?.trim().toUpperCase() || null,
      costPrice: Number(validated.costPrice) || 0,
      wholesalePrice: Number(validated.wholesalePrice) || 0,
      retailPrice: Number(validated.retailPrice) || 0,
      minPrice: validated.minPrice !== undefined && validated.minPrice !== null ? Number(validated.minPrice) : null,
      notes: validated.notes?.trim() || null,
      status: validated.status || "ACTIVE",
      isActive: Boolean(validated.isActive),
      sortOrder: validated.sortOrder || 0,
    };
    const item = validated.id
      ? await prisma.priceListItem.update({ where: { id: validated.id }, data })
      : await prisma.priceListItem.create({ data });

    if (item.brand) {
      await prisma.priceListBrand.upsert({
        where: { name: item.brand },
        update: {},
        create: { name: item.brand, orderIndex: await prisma.priceListBrand.count() },
      });
    }
    await logAudit({ userId: user.id || "unknown", action: validated.id ? "UPDATE" : "CREATE", module: "PRECIOS", entityType: "PriceListItem", entityId: item.id, afterData: { model: item.model, isActive: item.isActive } });
    revalidatePath(modulePath);
    return { success: true, data: item };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al guardar el producto" };
  }
}

export async function setActivePriceListAction(itemIds: string[]) {
  try {
    const user = await requirePermission("precios.write");
    const { itemIds: ids } = priceListOrderSchema.parse({ itemIds });
    await prisma.$transaction(async (tx) => {
      await tx.priceListItem.updateMany({ where: { status: "ACTIVE" }, data: { isActive: false } });
      if (ids.length) {
        await tx.priceListItem.updateMany({ where: { id: { in: ids }, status: "ACTIVE" }, data: { isActive: true } });
        for (const [sortOrder, id] of ids.entries()) {
          await tx.priceListItem.updateMany({ where: { id, status: "ACTIVE" }, data: { sortOrder } });
        }
      }
    });
    await logAudit({ userId: user.id || "unknown", action: "UPDATE_ACTIVE_LIST", module: "PRECIOS", afterData: { itemCount: ids.length } });
    revalidatePath(modulePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al guardar la lista activa" };
  }
}

export async function savePriceListBrandAction(input: PriceListBrandInput) {
  try {
    const user = await requirePermission("precios.write");
    const validated = priceListBrandSchema.parse(input);
    const brand = await prisma.priceListBrand.create({ data: { name: validated.name.toUpperCase(), color: validated.color, orderIndex: await prisma.priceListBrand.count() } });
    await logAudit({ userId: user.id || "unknown", action: "CREATE", module: "PRECIOS", entityType: "PriceListBrand", entityId: brand.id, afterData: { name: brand.name } });
    revalidatePath(modulePath);
    return { success: true, data: brand };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear la marca" };
  }
}

export async function reorderPriceListBrandsAction(brandIds: string[]) {
  try {
    await requirePermission("precios.write");
    const { brandIds: ids } = priceListBrandOrderSchema.parse({ brandIds });
    await prisma.$transaction(ids.map((id, orderIndex) => prisma.priceListBrand.update({ where: { id }, data: { orderIndex } })));
    revalidatePath(modulePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo ordenar las marcas" };
  }
}

export async function deletePriceListBrandAction(id: string) {
  try {
    const user = await requirePermission("precios.write");
    const brand = await prisma.priceListBrand.findUnique({ where: { id } });
    if (!brand) return { success: false, error: "Marca no encontrada" };
    await prisma.$transaction([
      prisma.priceListItem.updateMany({ where: { brand: brand.name }, data: { status: "INACTIVE", isActive: false } }),
      prisma.priceListBrand.delete({ where: { id } }),
    ]);
    await logAudit({ userId: user.id || "unknown", action: "ARCHIVE", module: "PRECIOS", entityType: "PriceListBrand", entityId: id, beforeData: { name: brand.name } });
    revalidatePath(modulePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo eliminar la marca" };
  }
}

export async function savePriceListLogoAction(logo: string | null) {
  try {
    const user = await requirePermission("precios.write");
    if (logo && logo.length > 3_000_000) return { success: false, error: "El logo supera el límite de 2 MB" };
    const value = logo === null ? Prisma.JsonNull : logo;
    await prisma.priceListSetting.upsert({ where: { key: "logo" }, update: { value }, create: { key: "logo", value } });
    await logAudit({ userId: user.id || "unknown", action: "UPDATE", module: "PRECIOS", entityType: "PriceListSetting", entityId: "logo" });
    revalidatePath(modulePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el logo" };
  }
}

export async function deletePriceListItemAction(id: string) {
  try {
    const user = await requirePermission("precios.write");
    const item = await prisma.priceListItem.update({ where: { id }, data: { status: "INACTIVE", isActive: false } });
    await logAudit({ userId: user.id || "unknown", action: "ARCHIVE", module: "PRECIOS", entityType: "PriceListItem", entityId: id, beforeData: { model: item.model } });
    revalidatePath(modulePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo archivar el producto" };
  }
}
