"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";
import { payReviewersForBatch, QC_REVIEW_RATE } from "../lib/batch-payment";
import {
  createRevisionBatchSchema,
  updateRevisionBatchStatusSchema,
  reviewDeviceSchema,
  revisionBatchDeviceSchema,
  CreateRevisionBatchInput,
  UpdateRevisionBatchStatusInput,
  ReviewDeviceInput,
} from "@/lib/validation/revision-batch";
import type { QcBatchStatus } from "@prisma/client";
import { z } from "zod";

type Result<T> = { success: true; data: T; message?: string } | { success: false; error: string };

/**
 * Función auxiliar para procesar texto libre de IMEIs / Números de Serie
 */
function parseBulkImeisText(text?: string | null) {
  if (!text || !text.trim()) return [];
  const lines = text
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  
  // Eliminar duplicados en el mismo texto ingresado
  return Array.from(new Set(lines));
}

/**
 * Crea un nuevo Lote de Revisión con sus equipos (DeviceUnit) en estado PENDING_QC
 */
export async function createRevisionBatchAction(input: CreateRevisionBatchInput) {
  try {
    const user = await requirePermission("qc.write");
    if (!user.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }
    const creator = await getPersistedCurrentUser();
    if (!creator || creator.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede ingresar lotes de compra." };
    }

    const validated = createRevisionBatchSchema.parse(input);
    const receivedBy = user.name || user.email || user.id;

    // Verificar sucursal activa
    const branchExists = await prisma.branch.findFirst({
      where: { name: validated.branch, status: "ACTIVE" },
      select: { id: true },
    });
    if (!branchExists) {
      return { success: false, error: "La sucursal seleccionada no existe o está inactiva." };
    }

    // Extraer IMEIs pegados masivamente o ítems individuales
    const bulkImeis = parseBulkImeisText(validated.devicesText);
    const defaultModel = validated.defaultModel?.trim() || "Modelo no especificado";
    const defaultBrand = validated.defaultBrand?.trim() || "Apple";

    const devicesToCreate: { imei?: string; serialNumber?: string; brand: string; model: string; storageGb?: number; color?: string }[] = [];

    // Agregar IMEIs escaneados masivamente
    for (const rawImei of bulkImeis) {
      const isCleanImei = /^\d{14,18}$/.test(rawImei);
      devicesToCreate.push({
        imei: isCleanImei ? rawImei : undefined,
        serialNumber: !isCleanImei ? rawImei : undefined,
        brand: defaultBrand,
        model: defaultModel,
      });
    }

    // Agregar ítems explícitos de la tabla
    for (const dev of validated.devices) {
      if (dev.model && (dev.imei || dev.serialNumber || bulkImeis.length === 0)) {
        devicesToCreate.push({
          imei: dev.imei ? dev.imei.trim() : undefined,
          serialNumber: dev.serialNumber ? dev.serialNumber.trim() : undefined,
          brand: dev.brand || defaultBrand,
          model: dev.model.trim(),
          storageGb: dev.storageGb ?? undefined,
          color: dev.color ? dev.color.trim() : undefined,
        });
      }
    }

    if (devicesToCreate.length === 0) {
      return {
        success: false,
        error: "Debe incluir al menos un IMEI o número de serie válido para registrar el Lote de Revisión.",
      };
    }

    // Comprobar si algún IMEI ya existe registrado en la base de datos.
    // Los que están en cola activa (PENDING_QC / IN_QC) sí bloquean el lote:
    // ya esperan revisión y sería un duplicado real.
    // Los demás (AVAILABLE / QUARANTINED / ARCHIVED — equipos ya revisados,
    // reparados o vendidos) se REINGRESAN: conservan su historial (mismo id
    // e inspecciones) y vuelven a pasar por QC en este lote.
    const imeisToCheck = devicesToCreate.map((d) => d.imei).filter(Boolean) as string[];
    const existingByImei = new Map<string, { id: string; imei: string | null; status: string }>();
    if (imeisToCheck.length > 0) {
      const existingUnits = await prisma.deviceUnit.findMany({
        where: { imei: { in: imeisToCheck } },
        select: { id: true, imei: true, status: true },
      });
      for (const unit of existingUnits) {
        if (unit.imei) existingByImei.set(unit.imei, unit);
      }
      const activeDupes = existingUnits.filter((u) => u.status === "PENDING_QC" || u.status === "IN_QC");
      if (activeDupes.length > 0) {
        const dupes = activeDupes.map((u) => u.imei).join(", ");
        return {
          success: false,
          error: `Los siguientes IMEIs ya están en un lote pendiente de revisión: ${dupes}`,
        };
      }
    }

    // Separar: equipos nuevos (se crean) vs reingresos (se reasignan al lote)
    const reingresoUnits = devicesToCreate.filter((d) => d.imei && existingByImei.has(d.imei));
    const newDevicesToCreate = devicesToCreate.filter((d) => !d.imei || !existingByImei.has(d.imei));
    const totalDevices = newDevicesToCreate.length + reingresoUnits.length;

    const createdBatch = await prisma.$transaction(async (tx) => {
      const batchNumber = validated.batchNumber?.trim() || (await nextOperationalNumber(tx, "REVISION_BATCH", "LOT"));

      const batch = await tx.qcRevisionBatch.create({
        data: {
          batchNumber,
          supplierId: validated.supplierId || null,
          supplierName: validated.supplierName.trim(),
          branch: validated.branch,
          receivedBy,
          status: "PENDING_REVIEW",
          totalDevices,
          reviewedDevices: 0,
          functionalCount: 0,
          nonFunctionalCount: 0,
          notes: validated.notes || null,
          devices: {
            create: newDevicesToCreate.map((d) => ({
              imei: d.imei || null,
              serialNumber: d.serialNumber || null,
              brand: d.brand,
              model: d.model,
              storageGb: d.storageGb || null,
              color: d.color || null,
              status: "PENDING_QC",
            })),
          },
        },
        include: {
          devices: true,
        },
      });

      // Reingresos: reasignar el device_unit existente al lote nuevo (mismo id → historial intacto)
      for (const re of reingresoUnits) {
        const existing = existingByImei.get(re.imei!);
        if (!existing) continue;
        await tx.deviceUnit.update({
          where: { id: existing.id },
          data: {
            batchId: batch.id,
            status: "PENDING_QC",
            brand: re.brand,
            model: re.model,
            storageGb: re.storageGb ?? undefined,
            color: re.color ?? undefined,
          },
        });
      }

      return batch;
    });

    await logAudit({
      userId: user.id,
      action: "qc_batch.create",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: createdBatch.id,
      afterData: {
        batchNumber: createdBatch.batchNumber,
        supplierName: createdBatch.supplierName,
        totalDevices: createdBatch.totalDevices,
      },
    });

    revalidatePath("/qc/lotes");
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: createdBatch,
      message:
        reingresoUnits.length > 0
          ? `Lote de Revisión ${createdBatch.batchNumber} creado con ${createdBatch.totalDevices} equipos (${reingresoUnits.length} reingresados con su historial).`
          : `Lote de Revisión ${createdBatch.batchNumber} creado con ${createdBatch.totalDevices} equipos.`,
    };
  } catch (error: any) {
    console.error("Error al crear Lote de Revisión:", error);
    return {
      success: false,
      error: error.message || "Error al procesar la creación del Lote de Revisión",
    };
  }
}

/**
 * Obtiene la lista de Lotes de Revisión con métricas y búsqueda
 */
export async function getRevisionBatchesAction(query?: string, status?: string) {
  try {
    await requirePermission("qc.read");
    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status as QcBatchStatus;
    }

    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { batchNumber: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { receivedBy: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        {
          devices: {
            some: {
              OR: [
                { imei: { contains: q, mode: "insensitive" } },
                { serialNumber: { contains: q, mode: "insensitive" } },
                { model: { contains: q, mode: "insensitive" } },
                { brand: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const batches = await prisma.qcRevisionBatch.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    return { success: true, data: batches };
  } catch (error: any) {
    console.error("Error al consultar Lotes de Revisión:", error);
    return { success: false, error: "Error al obtener los Lotes de Revisión", data: [] };
  }
}

/**
 * Obtiene el detalle completo de un Lote de Revisión por su ID o Número de Lote
 */
export async function getRevisionBatchDetailAction(idOrNumber: string) {
  try {
    await requirePermission("qc.read");
    const batch = await prisma.qcRevisionBatch.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { batchNumber: idOrNumber }],
      },
      include: {
        devices: {
          include: {
            inspections: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!batch) {
      return { success: false, error: "Lote de Revisión no encontrado" };
    }

    // Equipos reingresados conservan inspecciones de lotes anteriores (historial).
    // Para la revisión vigente solo cuentan las inspecciones posteriores a la
    // creación de ESTE lote — así un reingreso sin revisar aparece PENDIENTE.
    const batchStart = batch.createdAt;
    const devices = batch.devices.map((dev) => {
      const hasPreviousQC = dev.inspections.some((i) => i.createdAt < batchStart);
      return {
        ...dev,
        inspections: dev.inspections.filter((i) => i.createdAt >= batchStart),
        hasPreviousQC,
      };
    });

    // Calcular estadísticas dinámicas de los equipos
    const totalDevices = devices.length;
    let functionalCount = 0;
    let nonFunctionalCount = 0;
    let reviewedDevices = 0;

    for (const dev of devices) {
      const lastInspection = dev.inspections[0];
      if (lastInspection && lastInspection.status === "COMPLETED") {
        reviewedDevices++;
        if (lastInspection.result === "FUNCTIONAL") functionalCount++;
        else if (lastInspection.result === "NON_FUNCTIONAL") nonFunctionalCount++;
      }
    }

    return {
      success: true,
      data: {
        ...batch,
        devices,
        totalDevices,
        reviewedDevices,
        functionalCount,
        nonFunctionalCount,
      },
    };
  } catch (error: any) {
    console.error("Error al cargar detalle del lote:", error);
    return { success: false, error: "Error al cargar el detalle del Lote de Revisión" };
  }
}

/**
 * Actualiza el estado de un Lote de Revisión (ej. PENDING_REVIEW -> IN_REVIEW -> COMPLETED -> CANCELLED)
 */
export async function updateRevisionBatchStatusAction(input: UpdateRevisionBatchStatusInput) {
  try {
    const actor = await requirePermission("qc.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const validated = updateRevisionBatchStatusSchema.parse(input);
    const existing = await prisma.qcRevisionBatch.findUnique({
      where: { id: validated.id },
      include: { devices: true },
    });

    if (!existing) {
      return { success: false, error: "Lote de Revisión no encontrado" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.qcRevisionBatch.update({
        where: { id: validated.id },
        data: {
          status: validated.status as QcBatchStatus,
          notes: validated.notes !== undefined ? validated.notes : existing.notes,
          completedAt: validated.status === "COMPLETED" ? new Date() : existing.completedAt,
        },
      });

      // El pago a revisores NO ocurre aquí: solo en approveRevisionBatchAction
      // (el admin acepta el lote SUBMITTED y se acredita el pago).

      return u;
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.update_status",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: updated.id,
      beforeData: { status: existing.status },
      afterData: { status: updated.status, notes: updated.notes },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${updated.id}`);
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: updated,
      message: `Estado del Lote ${updated.batchNumber} actualizado a ${updated.status}.`,
    };
  } catch (error: any) {
    console.error("Error al actualizar estado del lote:", error);
    return { success: false, error: "Error al actualizar el estado del Lote de Revisión" };
  }
}

/**
 * El QC ENVÍA el lote para aprobación del admin. Solo procede si todos los
 * equipos del lote ya fueron revisados (reviewed == total). El lote pasa de
 * IN_REVIEW → SUBMITTED. El pago NO ocurre aquí (lo acredita el admin).
 */
export async function submitRevisionBatchAction(input: { id: string }): Promise<Result<{ id: string; batchNumber: string; status: string }>> {
  try {
    const actor = await requirePermission("qc.write");
    if (!actor.id) return { success: false, error: "La sesión no tiene un usuario identificable." };

    const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Lote inválido." };

    const batch = await prisma.qcRevisionBatch.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, batchNumber: true, status: true, reviewedDevices: true, totalDevices: true },
    });
    if (!batch) return { success: false, error: "Lote de Revisión no encontrado" };
    if (batch.status !== "IN_REVIEW") {
      return { success: false, error: `Solo se puede enviar un lote EN REVISIÓN (estado actual: ${batch.status}).` };
    }
    if (batch.reviewedDevices < batch.totalDevices) {
      return { success: false, error: `Faltan ${batch.totalDevices - batch.reviewedDevices} equipo(s) por revisar antes de enviar el lote.` };
    }

    const updated = await prisma.qcRevisionBatch.update({
      where: { id: batch.id },
      data: { status: "SUBMITTED" },
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.submit",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: batch.id,
      beforeData: { status: batch.status },
      afterData: { status: "SUBMITTED", batchNumber: batch.batchNumber },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${batch.id}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { id: updated.id, batchNumber: updated.batchNumber, status: updated.status },
      message: `Lote ${updated.batchNumber} enviado para aprobación. El administrador aceptará y se acreditará el pago.`,
    };
  } catch (error: any) {
    console.error("Error al enviar lote:", error);
    return { success: false, error: error.message || "Error al enviar el lote" };
  }
}

/**
 * El ADMIN acepta un lote SUBMITTED (completo, buenos y malos ya revisados).
 * Al aceptar: lote → COMPLETED y se acredita el pago a los revisores
 * (RD$50 por equipo, idempotente por externalKey). También permite devolver
 * a IN_REVIEW si faltó algo (reject → el QC sigue trabajando).
 */
export async function approveRevisionBatchAction(input: { id: string; reject?: boolean }): Promise<Result<{ id: string; batchNumber: string; status: string; paidReviewers: number }>> {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede aceptar el lote." };
    }

    const parsed = z.object({ id: z.string().min(1), reject: z.boolean().optional() }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Lote inválido." };

    const batch = await prisma.qcRevisionBatch.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, batchNumber: true, status: true },
    });
    if (!batch) return { success: false, error: "Lote de Revisión no encontrado" };
    if (batch.status !== "SUBMITTED") {
      return { success: false, error: `Solo se puede aceptar un lote ENVIADO (estado actual: ${batch.status}).` };
    }

    let paidReviewers = 0;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          status: parsed.data.reject ? "IN_REVIEW" : "COMPLETED",
          completedAt: parsed.data.reject ? null : new Date(),
        },
      });
      if (!parsed.data.reject) {
        paidReviewers = await payReviewersForBatch(batch.id, tx);
      }
      return u;
    });

    await logAudit({
      userId: persisted.id,
      action: parsed.data.reject ? "qc_batch.reject" : "qc_batch.approve",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: batch.id,
      beforeData: { status: batch.status },
      afterData: { status: updated.status, paidReviewers },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${batch.id}`);
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { id: updated.id, batchNumber: updated.batchNumber, status: updated.status, paidReviewers },
      message: parsed.data.reject
        ? `Lote ${updated.batchNumber} devuelto a revisión.`
        : `Lote ${updated.batchNumber} ACEPTADO. Pago acreditado a ${paidReviewers} revisor(es).`,
    };
  } catch (error: any) {
    console.error("Error al aprobar lote:", error);
    return { success: false, error: error.message || "Error al aprobar el lote" };
  }
}

/**
 * Elimina una compra (Lote de Revisión) por completo. Solo ADMIN.
 * - Equipos creados en este lote (sin historial previo): se borran con sus
 *   inspecciones y fotos.
 * - Equipos reingresados (con inspecciones de lotes anteriores): NO se borran —
 *   se desvinculan del lote (batchId null, QUARANTINED) para conservar su historial.
 * Devuelve la cantidad de equipos eliminados y desvinculados.
 */
export async function deleteRevisionBatchAction(input: { id: string }): Promise<Result<{ batchNumber: string; equiposEliminados: number; equiposDesvinculados: number }>> {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede eliminar una compra." };
    }
    const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Lote inválido." };

    const batch = await prisma.qcRevisionBatch.findUnique({
      where: { id: parsed.data.id },
      include: {
        devices: {
          include: {
            inspections: { orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true } },
          },
        },
      },
    });
    if (!batch) return { success: false, error: "Lote de Revisión no encontrado" };
    if (batch.status === "COMPLETED") {
      return { success: false, error: "No se puede eliminar un lote ya completado (historial pagado)." };
    }

    const batchStart = batch.createdAt;
    let equiposEliminados = 0;
    let equiposDesvinculados = 0;

    await prisma.$transaction(async (tx) => {
      for (const dev of batch.devices) {
        const hasPrevHistory = dev.inspections.some((i) => i.createdAt < batchStart);
        if (hasPrevHistory) {
          // Reingreso con historial: desvincular sin borrar
          await tx.deviceUnit.update({
            where: { id: dev.id },
            data: { batchId: null, status: "QUARANTINED" },
          });
          equiposDesvinculados++;
        } else {
          // Equipo de esta compra: borrar inspecciones (Restrict) y fotos (Cascade) primero
          await tx.qcInspection.deleteMany({ where: { deviceId: dev.id } });
          await tx.deviceUnit.delete({ where: { id: dev.id } });
          equiposEliminados++;
        }
      }

      await tx.qcRevisionBatch.delete({ where: { id: batch.id } });
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.delete",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: batch.id,
      beforeData: { batchNumber: batch.batchNumber, totalDevices: batch.totalDevices },
      afterData: { equiposEliminados, equiposDesvinculados },
    });

    revalidatePath("/qc/lotes");
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { batchNumber: batch.batchNumber, equiposEliminados, equiposDesvinculados },
      message:
        equiposDesvinculados > 0
          ? `Compra ${batch.batchNumber} eliminada: ${equiposEliminados} equipo(s) borrados, ${equiposDesvinculados} reingresado(s) conservados con su historial.`
          : `Compra ${batch.batchNumber} eliminada con ${equiposEliminados} equipo(s).`,
    };
  } catch (error: any) {
    console.error("Error al eliminar lote:", error);
    return { success: false, error: error.message || "Error al eliminar la compra" };
  }
}

/**
 * Agrega equipos a una compra (Lote de Revisión) existente. Solo ADMIN.
 * Reutiliza la lógica del alta: IMEIs nuevos se crean en el lote; IMEIs
 * existentes fuera de cola activa (AVAILABLE/QUARANTINED/ARCHIVED) se
 * REINGRESAN (mismo device_unit, historial intacto); los que ya están en
 * otro lote pendiente bloquean. Recalcula totalDevices del lote.
 */
export async function addDevicesToBatchAction(input: {
  batchId: string;
  devicesText?: string | null;
  defaultModel?: string | null;
  defaultBrand?: string | null;
  devices?: { model: string; brand?: string | null; storageGb?: number | null; imei?: string | null; serialNumber?: string | null }[];
}): Promise<Result<{ batchId: string; batchNumber: string; totalDevices: number; nuevos: number; reingresados: number }>> {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede agregar equipos a una compra." };
    }

    const schema = z.object({
      batchId: z.string().min(1),
      devicesText: z.string().optional().nullable(),
      defaultModel: z.string().optional().nullable(),
      defaultBrand: z.string().optional().nullable(),
      devices: z.array(revisionBatchDeviceSchema).optional().default([]),
    });
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Datos inválidos." };
    const { batchId, devicesText, defaultModel, defaultBrand, devices } = parsed.data;

    const batch = await prisma.qcRevisionBatch.findUnique({
      where: { id: batchId },
      include: { devices: { select: { imei: true, serialNumber: true } } },
    });
    if (!batch) return { success: false, error: "Lote de Revisión no encontrado" };
    if (batch.status === "COMPLETED" || batch.status === "CANCELLED") {
      return { success: false, error: "No se pueden agregar equipos a un lote completado o cancelado." };
    }

    const mdl = defaultModel?.trim() || "Modelo no especificado";
    const brd = defaultBrand?.trim() || "Apple";

    // IMEIs pegados masivamente
    const bulkImeis = parseBulkImeisText(devicesText);
    const devicesToCreate: { imei?: string; serialNumber?: string; brand: string; model: string; storageGb?: number }[] = [];
    for (const rawImei of bulkImeis) {
      const isCleanImei = /^\d{14,18}$/.test(rawImei);
      devicesToCreate.push({
        imei: isCleanImei ? rawImei : undefined,
        serialNumber: !isCleanImei ? rawImei : undefined,
        brand: brd,
        model: mdl,
      });
    }
    for (const dev of devices) {
      if (dev.model && (dev.imei || dev.serialNumber || bulkImeis.length === 0)) {
        devicesToCreate.push({
          imei: dev.imei ? dev.imei.trim() : undefined,
          serialNumber: dev.serialNumber ? dev.serialNumber.trim() : undefined,
          brand: dev.brand || brd,
          model: dev.model.trim(),
          storageGb: dev.storageGb ?? undefined,
        });
      }
    }
    if (devicesToCreate.length === 0) {
      return { success: false, error: "Debe incluir al menos un IMEI o número de serie." };
    }

    // IMEIs ya presentes en ESTE lote → duplicado dentro de la misma compra
    const existingInBatch = new Set<string>();
    for (const d of batch.devices) {
      if (d.imei) existingInBatch.add(d.imei);
      if (d.serialNumber) existingInBatch.add(d.serialNumber);
    }
    const dupInBatch = devicesToCreate.filter((d) => (d.imei && existingInBatch.has(d.imei)) || (d.serialNumber && existingInBatch.has(d.serialNumber)));
    if (dupInBatch.length > 0) {
      const list = dupInBatch.map((d) => d.imei || d.serialNumber).join(", ");
      return { success: false, error: `Estos equipos ya están en la compra ${batch.batchNumber}: ${list}` };
    }

    // Existentes en el sistema: fuera de cola activa → reingreso; en cola activa → bloquean
    const imeisToCheck = devicesToCreate.map((d) => d.imei).filter(Boolean) as string[];
    const existingByImei = new Map<string, { id: string; imei: string | null; status: string }>();
    if (imeisToCheck.length > 0) {
      const existingUnits = await prisma.deviceUnit.findMany({
        where: { imei: { in: imeisToCheck } },
        select: { id: true, imei: true, status: true },
      });
      for (const unit of existingUnits) {
        if (unit.imei) existingByImei.set(unit.imei, unit);
      }
      const activeDupes = existingUnits.filter((u) => u.status === "PENDING_QC" || u.status === "IN_QC");
      if (activeDupes.length > 0) {
        const dupes = activeDupes.map((u) => u.imei).join(", ");
        return { success: false, error: `Los siguientes IMEIs ya están en un lote pendiente de revisión: ${dupes}` };
      }
    }

    const reingresoUnits = devicesToCreate.filter((d) => d.imei && existingByImei.has(d.imei));
    const newDevicesToCreate = devicesToCreate.filter((d) => !d.imei || !existingByImei.has(d.imei));

    const updatedBatch = await prisma.$transaction(async (tx) => {
      await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: { totalDevices: batch.totalDevices + devicesToCreate.length },
      });

      if (newDevicesToCreate.length > 0) {
        await tx.deviceUnit.createMany({
          data: newDevicesToCreate.map((d) => ({
            imei: d.imei || null,
            serialNumber: d.serialNumber || null,
            brand: d.brand,
            model: d.model,
            storageGb: d.storageGb || null,
            status: "PENDING_QC",
            batchId: batch.id,
          })),
        });
      }

      for (const re of reingresoUnits) {
        const existing = existingByImei.get(re.imei!);
        if (!existing) continue;
        await tx.deviceUnit.update({
          where: { id: existing.id },
          data: { batchId: batch.id, status: "PENDING_QC", brand: re.brand, model: re.model, storageGb: re.storageGb ?? undefined },
        });
      }

      return tx.qcRevisionBatch.findUnique({ where: { id: batch.id } });
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.add_devices",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: batch.id,
      afterData: { batchNumber: batch.batchNumber, nuevos: newDevicesToCreate.length, reingresados: reingresoUnits.length },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${batch.id}`);
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        totalDevices: updatedBatch?.totalDevices ?? batch.totalDevices + devicesToCreate.length,
        nuevos: newDevicesToCreate.length,
        reingresados: reingresoUnits.length,
      },
      message:
        reingresoUnits.length > 0
          ? `${newDevicesToCreate.length} equipo(s) agregado(s) y ${reingresoUnits.length} reingresado(s) a ${batch.batchNumber}.`
          : `${newDevicesToCreate.length} equipo(s) agregado(s) a ${batch.batchNumber}.`,
    };
  } catch (error: any) {
    console.error("Error al agregar equipos al lote:", error);
    return { success: false, error: error.message || "Error al agregar equipos al lote" };
  }
}

/**
 * Obtiene la lista de proveedores de QC y sucursales para los selectores del formulario
 */
export async function getRevisionBatchFormDataAction() {
  try {
    await requirePermission("qc.read");
    const [suppliers, branches, lastBatch, existingModels] = await Promise.all([
      prisma.qcSupplier.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.branch.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      // Último lote creado → su proveedor es el "último usado" (predeterminado del formulario)
      prisma.qcRevisionBatch.findFirst({
        orderBy: { createdAt: "desc" },
        select: { supplierId: true, supplierName: true },
      }),
      // Modelos ya existentes en el sistema (para autocompletar: marca + modelo)
      prisma.$queryRaw<{ brand: string; model: string; count: number }[]>`
        SELECT UPPER(brand) AS brand, UPPER(model) AS model, COUNT(*)::int AS count
        FROM device_unit
        GROUP BY UPPER(brand), UPPER(model)
        ORDER BY count DESC
        LIMIT 500
      `,
    ]);

    return {
      success: true,
      data: {
        suppliers,
        branches,
        lastSupplierId: lastBatch?.supplierId ?? null,
        lastSupplierName: lastBatch?.supplierName ?? null,
        existingModels: existingModels.map((m) => `${m.brand} ${m.model}`),
      },
    };
  } catch (error: any) {
    console.error("Error al obtener datos auxiliares para el lote:", error);
    return {
      success: false,
      data: { suppliers: [], branches: [], lastSupplierId: null, lastSupplierName: null, existingModels: [] },
    };
  }
}

/**
 * Registra la revisión QC de un equipo dentro de un Lote de Revisión.
 * Crea una inspección COMPLETED, actualiza el estado operativo del equipo
 * y recalcula los contadores del lote. Si con esta revisión quedan todos
 * los equipos revisados, el lote pasa automáticamente a COMPLETED.
 */
export async function reviewDeviceAction(input: ReviewDeviceInput) {
  try {
    const actor = await requirePermission("qc.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const validated = reviewDeviceSchema.parse(input);

    const device = await prisma.deviceUnit.findUnique({
      where: { id: validated.deviceId },
      include: { batch: true },
    });
    if (!device) {
      return { success: false, error: "El equipo no existe." };
    }
    if (!device.batch) {
      return { success: false, error: "El equipo no pertenece a ningún Lote de Revisión." };
    }
    if (device.batch.status === "CANCELLED") {
      return { success: false, error: "No se puede revisar un equipo de un lote cancelado." };
    }
    const reviewer = await getPersistedCurrentUser();
    if (reviewer && reviewer.roleCode !== "ADMIN" && device.assignedToId !== reviewer.id) {
      return { success: false, error: "Este IMEI no está asignado a tu usuario." };
    }

    const batch = device.batch;
    const reviewerName = actor.name || actor.email || "Control de Calidad";

    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Si ya había una inspección completada EN ESTE LOTE, la nueva la reemplaza
      // (cadena de correcciones). Las inspecciones de lotes anteriores (reingresos)
      // NO se encadenan: el equipo vuelve a revisarse desde cero.
      const lastCompleted = await tx.qcInspection.findFirst({
        where: { deviceId: device.id, status: "COMPLETED", createdAt: { gte: batch.createdAt } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      await tx.qcInspection.create({
        data: {
          deviceId: device.id,
          reviewerId: actor.id,
          reviewerNameSnapshot: reviewerName.slice(0, 160),
          status: "COMPLETED",
          result: validated.result,
          grade: validated.grade,
          batteryHealth: validated.batteryHealth ?? null,
          functionalityNotes: validated.notes || null,
          reviewedAt: new Date(),
          supersedesId: lastCompleted?.id ?? null,
        },
      });

      await tx.deviceUnit.update({
        where: { id: device.id },
        data: {
          status: validated.result === "FUNCTIONAL" ? "AVAILABLE" : "QUARANTINED",
        },
      });

      // Recalcular contadores del lote desde las inspecciones reales (idempotente).
      // Solo cuentan inspecciones de ESTE lote (createdAt >= lote) — los reingresos
      // sin revisar no se contabilizan como revisados.
      const batchDevices = await tx.deviceUnit.findMany({
        where: { batchId: batch.id },
        include: {
          inspections: { where: { createdAt: { gte: batch.createdAt } }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      let reviewed = 0;
      let functional = 0;
      let nonFunctional = 0;
      for (const d of batchDevices) {
        const last = d.inspections[0];
        if (last && last.status === "COMPLETED") {
          reviewed++;
          if (last.result === "FUNCTIONAL") functional++;
          else if (last.result === "NON_FUNCTIONAL") nonFunctional++;
        }
      }

      const allReviewed = batchDevices.length > 0 && reviewed === batchDevices.length;
      // Al terminar de revisar todos los equipos el lote queda listo en
      // IN_REVIEW (reviewed == total). El QC lo ENVÍA con submitRevisionBatchAction
      // y el admin lo ACEPTA con approveRevisionBatchAction (ahí se paga).
      const nextStatus =
        batch.status === "COMPLETED"
          ? "COMPLETED"
          : batch.status === "SUBMITTED"
            ? "SUBMITTED"
            : batch.status;

      const updatedBatch = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: reviewed,
          functionalCount: functional,
          nonFunctionalCount: nonFunctional,
          status: nextStatus as QcBatchStatus,
          completedAt: nextStatus === "COMPLETED" ? batch.completedAt : null,
        },
      });

      // Sin pago aquí: el pago a revisores ocurre SOLO cuando el admin
      // acepta el lote (approveRevisionBatchAction).

      return updatedBatch;
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.review_device",
      module: "qc",
      entityType: "qc_inspection",
      entityId: device.id,
      afterData: {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        deviceId: device.id,
        result: validated.result,
        grade: validated.grade,
      },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${batch.id}`);
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    const completed = updatedBatch.reviewedDevices >= updatedBatch.totalDevices;
    return {
      success: true,
      message: `Equipo ${validated.result === "FUNCTIONAL" ? "funcional" : "no funcional"} (grado ${validated.grade}). Lote ${batch.batchNumber}${completed ? " completado." : ""}`,
      data: updatedBatch,
    };
  } catch (error: any) {
    console.error("Error al revisar equipo:", error);
    return {
      success: false,
      error: error.message || "Error al registrar la revisión del equipo",
    };
  }
}

/**
 * Recuperación de equipos no funcionales (port de System `/compras/[id]/no-funcionales`):
 * el admin marca un equipo defectuoso como FUNCIONAL tras verificación física.
 * Crea una inspección FUNCTIONAL nueva (supersede a la anterior, historial intacto),
 * pasa el equipo a AVAILABLE y recalcula los contadores del lote.
 */
export async function markDeviceFunctionalAction(input: { deviceId: string }): Promise<Result<{ batchId: string; batchNumber: string; reviewedDevices: number; functionalCount: number; nonFunctionalCount: number }>> {
  try {
    const actor = await requirePermission("qc.write");
    const parsed = z.object({ deviceId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Equipo inválido." };
    const { deviceId } = parsed.data;

    const device = await prisma.deviceUnit.findUnique({
      where: { id: deviceId },
      include: { batch: true },
    });
    if (!device) return { success: false, error: "El equipo no existe." };
    if (!device.batch) return { success: false, error: "El equipo no pertenece a ningún Lote de Revisión." };

    const batch = device.batch;
    const reviewerName = actor.name || actor.email || "Administración";

    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Inspección nueva que reemplaza a la última completada EN ESTE LOTE
      // (cadena de correcciones). Inspecciones de lotes anteriores no se encadenan.
      const lastCompleted = await tx.qcInspection.findFirst({
        where: { deviceId: device.id, status: "COMPLETED", createdAt: { gte: batch.createdAt } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      await tx.qcInspection.create({
        data: {
          deviceId: device.id,
          reviewerId: actor.id,
          reviewerNameSnapshot: reviewerName.slice(0, 160),
          status: "COMPLETED",
          result: "FUNCTIONAL",
          grade: "A",
          functionalityNotes: "Marcado funcional por administración (verificación física)",
          reviewedAt: new Date(),
          supersedesId: lastCompleted?.id ?? null,
        },
      });

      await tx.deviceUnit.update({
        where: { id: device.id },
        data: { status: "AVAILABLE" },
      });

      // Recalcular contadores del lote (idempotente) — solo inspecciones de ESTE lote
      const batchDevices = await tx.deviceUnit.findMany({
        where: { batchId: batch.id },
        include: {
          inspections: { where: { createdAt: { gte: batch.createdAt } }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      let reviewed = 0;
      let functional = 0;
      let nonFunctional = 0;
      for (const d of batchDevices) {
        const last = d.inspections[0];
        if (last && last.status === "COMPLETED") {
          reviewed++;
          if (last.result === "FUNCTIONAL") functional++;
          else if (last.result === "NON_FUNCTIONAL") nonFunctional++;
        }
      }
      const allReviewed = batchDevices.length > 0 && reviewed === batchDevices.length;
      // El lote queda listo en IN_REVIEW; el QC lo envía y el admin lo acepta
      // (ahí se paga). No se auto-completa.
      const nextStatus =
        batch.status === "COMPLETED"
          ? "COMPLETED"
          : batch.status === "SUBMITTED"
            ? "SUBMITTED"
            : batch.status;

      const updated = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: reviewed,
          functionalCount: functional,
          nonFunctionalCount: nonFunctional,
          status: nextStatus as QcBatchStatus,
          completedAt: nextStatus === "COMPLETED" ? batch.completedAt : null,
        },
      });

      // Sin pago aquí: el pago a revisores ocurre SOLO cuando el admin
      // acepta el lote (approveRevisionBatchAction).

      return updated;
    });

    await logAudit({
      userId: actor.id,
      action: "qc_batch.device_mark_functional",
      module: "qc",
      entityType: "qc_inspection",
      entityId: device.id,
      afterData: { batchId: batch.id, batchNumber: batch.batchNumber, deviceId: device.id },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${batch.id}`);
    revalidatePath("/qc/equipos-revisados");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Equipo marcado como funcional. Lote ${batch.batchNumber} actualizado.`,
      data: {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        reviewedDevices: updatedBatch.reviewedDevices,
        functionalCount: updatedBatch.functionalCount,
        nonFunctionalCount: updatedBatch.nonFunctionalCount,
      },
    };
  } catch (error: any) {
    console.error("Error al marcar equipo funcional:", error);
    return { success: false, error: error.message || "Error al marcar el equipo como funcional" };
  }
}

/**
 * Inicio del día en America/Santo_Domingo (UTC-4) como fecha UTC.
 * El día local comienza a las 04:00 UTC.
 */
function santoDomingoStartOfDay(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "1";
  return new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), 4, 0, 0));
}

/**
 * Panel del Control de Calidad (fórmula SDigitalSystem): muestra los IMEIs
 * asignados al QC (device_unit.assigned_to_id), sus solicitudes y estadísticas.
 * El administrador se gestiona desde /qc/lotes y /qc/solicitudes.
 */
export async function getQcDashboardAction() {
  try {
    await requirePermission("qc.read");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) {
      return { success: false, error: "Sesión no persistida.", data: null };
    }
    if (persisted.roleCode === "ADMIN") {
      return { success: true, data: null, isAdmin: true };
    }

    const startOfDay = santoDomingoStartOfDay();

    const [devices, hoyTotal, hoyFuncional, hoyNoFuncional, myRequests, wallet] = await Promise.all([
      prisma.deviceUnit.findMany({
        where: { assignedToId: persisted.id, batch: { status: { not: "CANCELLED" } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
          batch: {
            select: {
              id: true,
              batchNumber: true,
              supplierName: true,
              createdAt: true,
              status: true,
              totalDevices: true,
              reviewedDevices: true,
            },
          },
          inspections: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      }),
      prisma.qcInspection.count({
        where: { reviewerId: persisted.id, reviewedAt: { gte: startOfDay }, status: "COMPLETED" },
      }),
      prisma.qcInspection.count({
        where: { reviewerId: persisted.id, reviewedAt: { gte: startOfDay }, status: "COMPLETED", result: "FUNCTIONAL" },
      }),
      prisma.qcInspection.count({
        where: { reviewerId: persisted.id, reviewedAt: { gte: startOfDay }, status: "COMPLETED", result: "NON_FUNCTIONAL" },
      }),
      prisma.qcImeiRequest.findMany({
        where: { requesterId: persisted.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.wallet.findUnique({
        where: { userId: persisted.id },
        select: { balance: true },
      }),
    ]);

    // Reingresos: solo cuentan inspecciones posteriores a la creación del lote actual
    let revisados = 0;
    const devicesConInspeccion = devices.map((d) => {
      const batchStart = d.batch?.createdAt ?? new Date(0);
      const vigente = d.inspections.find((i) => i.createdAt >= batchStart) ?? null;
      if (vigente && vigente.status === "COMPLETED") revisados++;
      return { ...d, lastInspection: vigente };
    });

    return {
      success: true,
      data: {
        devices: devicesConInspeccion,
        myRequests,
        stats: {
          asignados: devices.length,
          revisados,
          pendientes: devices.length - revisados,
          revisadosHoy: hoyTotal,
          aprobadosHoy: hoyFuncional,
          rechazadosHoy: hoyNoFuncional,
          ganadoHoy: hoyTotal * QC_REVIEW_RATE,
          saldoWallet: wallet ? Number(wallet.balance) : 0,
        },
        welcome:
          "Recuerda revisar cada detalle minuciosamente. ¡Tu trabajo garantiza la calidad de la mercancía!",
      },
    };
  } catch (error: any) {
    console.error("Error al cargar panel QC:", error);
    return { success: false, error: "Error al cargar el panel de Control de Calidad", data: null };
  }
}

/**
 * Gestión de pagos QC (solo ADMIN): lotes SUBMITTED (por aceptar y pagar)
 * y lotes COMPLETED recientes (historial de pagos acreditados).
 * Cada lote trae su monto estimado: revisados × QC_REVIEW_RATE.
 */
export async function getQcPaymentsAction(): Promise<
  Result<{
    pending: Array<{
      id: string;
      batchNumber: string;
      supplierName: string;
      totalDevices: number;
      reviewedDevices: number;
      functionalCount: number;
      nonFunctionalCount: number;
      estimatedAmount: number;
      submittedBy: string | null;
      submittedAt: Date;
    }>;
    history: Array<{
      id: string;
      batchNumber: string;
      supplierName: string;
      totalDevices: number;
      reviewedDevices: number;
      functionalCount: number;
      nonFunctionalCount: number;
      estimatedAmount: number;
      completedAt: Date | null;
    }>;
  }>
> {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede gestionar los pagos de QC." };
    }

    const [pending, history, audits] = await Promise.all([
      // Lotes enviados esperando aceptación
      prisma.qcRevisionBatch.findMany({
        where: { status: "SUBMITTED" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          batchNumber: true,
          supplierName: true,
          totalDevices: true,
          reviewedDevices: true,
          functionalCount: true,
          nonFunctionalCount: true,
          updatedAt: true,
        },
      }),
      // Historial de completados (pagos acreditados)
      prisma.qcRevisionBatch.findMany({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 30,
        select: {
          id: true,
          batchNumber: true,
          supplierName: true,
          totalDevices: true,
          reviewedDevices: true,
          functionalCount: true,
          nonFunctionalCount: true,
          completedAt: true,
        },
      }),
      // Quién envió cada lote (audit log de qc_batch.submit)
      prisma.auditLog.findMany({
        where: { action: "qc_batch.submit" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          entityId: true,
          userId: true,
          createdAt: true,
          user: { select: { name: true, username: true } },
        },
      }),
    ]);

    const submitterByBatch = new Map<string, { name: string | null; submittedAt: Date }>();
    for (const a of audits) {
      if (a.entityId && !submitterByBatch.has(a.entityId)) {
        submitterByBatch.set(a.entityId, {
          name: a.user?.name ?? a.user?.username ?? "QC",
          submittedAt: a.createdAt,
        });
      }
    }

    const RATE = QC_REVIEW_RATE;
    const mapPending = pending.map((b) => {
      const s = submitterByBatch.get(b.id);
      return {
        ...b,
        submittedBy: s?.name ?? null,
        submittedAt: s?.submittedAt ?? b.updatedAt,
        estimatedAmount: b.reviewedDevices * RATE,
      };
    });
    const mapHistory = history.map((b) => ({
      ...b,
      estimatedAmount: b.reviewedDevices * RATE,
    }));

    return {
      success: true,
      data: { pending: mapPending, history: mapHistory },
    };
  } catch (error: any) {
    console.error("Error al cargar pagos QC:", error);
    return { success: false, error: error.message || "Error al cargar los pagos de QC" };
  }
}
