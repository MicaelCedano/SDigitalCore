"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Result<T> = { success: true; data: T; message?: string } | { success: false; error: string };

/**
 * Edición de datos del equipo (device_unit) desde Equipos Revisados.
 * Solo admin. NO se editan imei/serial (identidad) ni status (lo maneja el
 * flujo QC: revisiones, reingresos, verificación física).
 */
const updateDeviceSchema = z.object({
  deviceId: z.string().min(1),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().min(1).max(150),
  storageGb: z.number().int().min(1).max(4096).nullable().optional(),
  color: z.string().trim().max(80).optional(),
});

export async function updateDeviceAction(input: z.input<typeof updateDeviceSchema>): Promise<Result<{ deviceId: string }>> {
  try {
    await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede editar equipos." };
    }
    const data = updateDeviceSchema.parse(input);

    const device = await prisma.deviceUnit.findUnique({ where: { id: data.deviceId }, select: { id: true } });
    if (!device) return { success: false, error: "Equipo no encontrado." };

    const next = {
      brand: data.brand?.trim() || null,
      model: data.model.trim(),
      storageGb: data.storageGb ?? null,
      color: data.color?.trim() || null,
    };

    const before = await prisma.deviceUnit.findUnique({
      where: { id: data.deviceId },
      select: { brand: true, model: true, storageGb: true, color: true },
    });

    await prisma.deviceUnit.update({ where: { id: data.deviceId }, data: next });

    await logAudit({
      userId: persisted.id,
      action: "qc.device.update",
      module: "qc",
      entityType: "device_unit",
      entityId: data.deviceId,
      beforeData: {
        brand: before?.brand ?? null,
        model: before?.model ?? null,
        storageGb: before?.storageGb ?? null,
        color: before?.color ?? null,
      },
      afterData: next,
    });

    for (const path of ["/qc/equipos-revisados", "/qc", "/qc/lotes"]) revalidatePath(path);
    return { success: true, data: { deviceId: data.deviceId }, message: "Equipo actualizado." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el equipo." };
  }
}
