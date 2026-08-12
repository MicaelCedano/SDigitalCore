"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const modelImageSchema = z.object({
  brand: z.string().trim().min(1, "Marca requerida").max(100),
  model: z.string().trim().min(1, "Modelo requerido").max(150),
  imageUrl: z.string().trim().url("URL de imagen inválida").max(2000),
});

const removeModelImageSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(150),
});

// Las claves se guardan normalizadas a mayúsculas para colapsar duplicados
// por casing ("Apple" vs "APPLE" son el mismo modelo).
function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Guarda (o actualiza) la imagen de referencia de un modelo. Upsert por
 * (brand, model) normalizados — patrón SDigitalSystem.
 */
export async function saveModelImageAction(input: z.input<typeof modelImageSchema>) {
  try {
    const actor = await requirePermission("settings.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const validated = modelImageSchema.parse(input);
    const brand = normalizeKey(validated.brand);
    const model = normalizeKey(validated.model);

    const image = await prisma.qcModelImage.upsert({
      where: { brand_model: { brand, model } },
      create: { brand, model, imageUrl: validated.imageUrl },
      update: { imageUrl: validated.imageUrl },
    });

    await logAudit({
      userId: actor.id,
      action: "qc_model_image.save",
      module: "configuracion",
      entityType: "qc_model_image",
      entityId: image.id,
      afterData: { brand, model, imageUrl: validated.imageUrl },
    });

    revalidatePath("/configuracion/imagenes-qc");
    return { success: true, data: image };
  } catch (error: any) {
    console.error("Error al guardar imagen del modelo:", error);
    return { success: false, error: error.message || "Error al guardar la imagen del modelo" };
  }
}

/**
 * Quita la imagen de referencia de un modelo.
 */
export async function removeModelImageAction(input: z.input<typeof removeModelImageSchema>) {
  try {
    const actor = await requirePermission("settings.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const validated = removeModelImageSchema.parse(input);
    const brand = normalizeKey(validated.brand);
    const model = normalizeKey(validated.model);

    const existing = await prisma.qcModelImage.findUnique({
      where: { brand_model: { brand, model } },
    });

    if (existing) {
      await prisma.qcModelImage.update({
        where: { id: existing.id },
        data: { imageUrl: null },
      });
      await logAudit({
        userId: actor.id,
        action: "qc_model_image.remove",
        module: "configuracion",
        entityType: "qc_model_image",
        entityId: existing.id,
        beforeData: { brand, model, imageUrl: existing.imageUrl },
      });
    }

    revalidatePath("/configuracion/imagenes-qc");
    return { success: true };
  } catch (error: any) {
    console.error("Error al quitar imagen del modelo:", error);
    return { success: false, error: error.message || "Error al quitar la imagen del modelo" };
  }
}
