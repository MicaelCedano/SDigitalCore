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
              take: 1,
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!batch) {
      return { success: false, error: "Lote de Revisión no encontrado" };
    }

    // Calcular estadísticas dinámicas de los equipos
    const totalDevices = batch.devices.length;
    let functionalCount = 0;
    let nonFunctionalCount = 0;
    let reviewedDevices = 0;

    for (const dev of batch.devices) {
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

      // Al marcar el lote COMPLETED se paga a los revisores (RD$50 por equipo).
      if (validated.status === "COMPLETED") {
        await payReviewersForBatch(validated.id, tx);
      }

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
      // Si ya había una inspección completada, la nueva la reemplaza (cadena de correcciones)
      const lastCompleted = await tx.qcInspection.findFirst({
        where: { deviceId: device.id, status: "COMPLETED" },
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

      // Recalcular contadores del lote desde las inspecciones reales (idempotente)
      const batchDevices = await tx.deviceUnit.findMany({
        where: { batchId: batch.id },
        include: {
          inspections: { orderBy: { createdAt: "desc" }, take: 1 },
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
      const nextStatus =
        allReviewed
          ? "COMPLETED"
          : batch.status === "COMPLETED"
            ? "COMPLETED"
            : batch.status;

      const updatedBatch = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: reviewed,
          functionalCount: functional,
          nonFunctionalCount: nonFunctional,
          status: nextStatus,
          completedAt: allReviewed ? new Date() : batch.completedAt,
        },
      });

      // Fórmula SDigitalSystem: al quedar el lote COMPLETED (entregado),
      // cada revisor gana RD$50 por equipo revisado (idempotente).
      if (nextStatus === "COMPLETED") {
        await payReviewersForBatch(batch.id, tx);
      }

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
      // Inspección nueva que reemplaza a la última completada (cadena de correcciones)
      const lastCompleted = await tx.qcInspection.findFirst({
        where: { deviceId: device.id, status: "COMPLETED" },
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

      // Recalcular contadores del lote (idempotente)
      const batchDevices = await tx.deviceUnit.findMany({
        where: { batchId: batch.id },
        include: { inspections: { orderBy: { createdAt: "desc" }, take: 1 } },
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
      const nextStatus =
        allReviewed
          ? "COMPLETED"
          : batch.status === "COMPLETED"
            ? "COMPLETED"
            : batch.status;

      const updated = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: reviewed,
          functionalCount: functional,
          nonFunctionalCount: nonFunctional,
          status: nextStatus,
          completedAt: allReviewed ? new Date() : batch.completedAt,
        },
      });

      if (nextStatus === "COMPLETED") {
        await payReviewersForBatch(batch.id, tx);
      }

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
          batch: { select: { id: true, batchNumber: true, supplierName: true } },
          inspections: { orderBy: { createdAt: "desc" }, take: 1 },
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

    let revisados = 0;
    const devicesConInspeccion = devices.map((d) => {
      const last = d.inspections[0] ?? null;
      if (last && last.status === "COMPLETED") revisados++;
      return { ...d, lastInspection: last };
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
