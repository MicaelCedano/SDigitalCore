"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Result<T> = { success: true; data: T; message?: string } | { success: false; error: string };

/**
 * Edición de datos del equipo (device_unit) desde Equipos Revisados.
 * Solo admin. NO se editan imei/serial (identidad). La clasificación de la
 * inspección sí puede corregirse desde el registro de equipos revisados.
 */
const updateDeviceSchema = z.object({
  deviceId: z.string().min(1),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().min(1).max(150),
  storageGb: z.number().int().min(1).max(4096).nullable().optional(),
  color: z.string().trim().max(80).optional(),
  result: z.enum(["FUNCTIONAL", "NON_FUNCTIONAL", "UNSPECIFIED"]),
});

export async function updateDeviceAction(input: z.input<typeof updateDeviceSchema>): Promise<Result<{ deviceId: string }>> {
  try {
    await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede editar equipos." };
    }
    const data = updateDeviceSchema.parse(input);

    const device = await prisma.deviceUnit.findUnique({
      where: { id: data.deviceId },
      include: {
        batch: true,
        inspections: {
          where: { status: "COMPLETED" },
          orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
    });
    if (!device) return { success: false, error: "Equipo no encontrado." };

    const next = {
      brand: data.brand?.trim() || null,
      model: data.model.trim(),
      storageGb: data.storageGb ?? null,
      color: data.color?.trim() || null,
    };

    const currentInspection = device.inspections[0];
    const previousStatus = device.status;
    const nextStatus = data.result === "FUNCTIONAL" ? "AVAILABLE" : data.result === "NON_FUNCTIONAL" ? "QUARANTINED" : "PENDING_QC";

    await prisma.$transaction(async (tx) => {
      await tx.deviceUnit.update({ where: { id: data.deviceId }, data: { ...next, status: nextStatus } });

      if (currentInspection) {
        await tx.qcInspection.update({
          where: { id: currentInspection.id },
          data: { result: data.result },
        });
      }

      if (device.batch && currentInspection?.createdAt >= device.batch.createdAt) {
        const batchDevices = await tx.deviceUnit.findMany({
          where: { batchId: device.batch.id },
          include: {
            inspections: {
              where: { status: "COMPLETED", createdAt: { gte: device.batch.createdAt } },
              orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        });
        let reviewedDevices = 0;
        let functionalCount = 0;
        let nonFunctionalCount = 0;
        for (const batchDevice of batchDevices) {
          const inspection = batchDevice.inspections[0];
          if (!inspection) continue;
          reviewedDevices += 1;
          if (inspection.result === "FUNCTIONAL") functionalCount += 1;
          if (inspection.result === "NON_FUNCTIONAL") nonFunctionalCount += 1;
        }
        await tx.qcRevisionBatch.update({
          where: { id: device.batch.id },
          data: { reviewedDevices, functionalCount, nonFunctionalCount },
        });
      }
    });

    await logAudit({
      userId: persisted.id,
      action: "qc.device.update",
      module: "qc",
      entityType: "device_unit",
      entityId: data.deviceId,
      beforeData: {
        brand: device.brand ?? null,
        model: device.model,
        storageGb: device.storageGb ?? null,
        color: device.color ?? null,
        result: currentInspection?.result ?? null,
        status: previousStatus,
      },
      afterData: { ...next, result: data.result, status: nextStatus },
    });

    for (const path of ["/qc/equipos-revisados", "/qc", "/qc/lotes"]) revalidatePath(path);
    return { success: true, data: { deviceId: data.deviceId }, message: "Equipo actualizado." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el equipo." };
  }
}
