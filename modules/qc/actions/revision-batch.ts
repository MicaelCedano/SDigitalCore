"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { nextOperationalNumber } from "@/lib/db/daily-sequence";
import {
  createRevisionBatchSchema,
  updateRevisionBatchStatusSchema,
  reviewDeviceSchema,
  assignRevisionBatchSchema,
  CreateRevisionBatchInput,
  UpdateRevisionBatchStatusInput,
  ReviewDeviceInput,
  AssignRevisionBatchInput,
} from "@/lib/validation/revision-batch";
import type { QcBatchStatus } from "@prisma/client";

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

    // Comprobar si algún IMEI ya existe registrado en la base de datos
    const imeisToCheck = devicesToCreate.map((d) => d.imei).filter(Boolean) as string[];
    if (imeisToCheck.length > 0) {
      const existingUnits = await prisma.deviceUnit.findMany({
        where: { imei: { in: imeisToCheck } },
        select: { imei: true },
      });
      if (existingUnits.length > 0) {
        const dupes = existingUnits.map((u) => u.imei).join(", ");
        return {
          success: false,
          error: `Los siguientes IMEIs ya existen en el sistema: ${dupes}`,
        };
      }
    }

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
          totalDevices: devicesToCreate.length,
          reviewedDevices: 0,
          functionalCount: 0,
          nonFunctionalCount: 0,
          notes: validated.notes || null,
          devices: {
            create: devicesToCreate.map((d) => ({
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
      message: `Lote de Revisión ${createdBatch.batchNumber} creado con ${createdBatch.totalDevices} equipos.`,
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
    const viewer = await getPersistedCurrentUser();
    const where: any = {};
    if (viewer && viewer.roleCode !== "ADMIN") {
      where.assignedToId = viewer.id;
    }

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
        assignedTo: { select: { id: true, name: true, username: true } },
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
        assignedTo: { select: { id: true, name: true, username: true } },
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
    const viewer = await getPersistedCurrentUser();
    if (viewer && viewer.roleCode !== "ADMIN" && batch.assignedToId !== viewer.id) {
      return { success: false, error: "Este lote no está asignado a tu usuario." };
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

    const updated = await prisma.qcRevisionBatch.update({
      where: { id: validated.id },
      data: {
        status: validated.status as QcBatchStatus,
        notes: validated.notes !== undefined ? validated.notes : existing.notes,
        completedAt: validated.status === "COMPLETED" ? new Date() : existing.completedAt,
      },
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
    const [suppliers, branches] = await Promise.all([
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
    ]);

    return {
      success: true,
      data: {
        suppliers,
        branches,
      },
    };
  } catch (error: any) {
    console.error("Error al obtener datos auxiliares para el lote:", error);
    return {
      success: false,
      data: { suppliers: [], branches: [] },
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
    if (reviewer && reviewer.roleCode !== "ADMIN" && device.batch.assignedToId !== reviewer.id) {
      return { success: false, error: "Este lote no está asignado a tu usuario." };
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

      return tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: reviewed,
          functionalCount: functional,
          nonFunctionalCount: nonFunctional,
          status: nextStatus,
          completedAt: allReviewed ? new Date() : batch.completedAt,
        },
      });
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
 * Asigna un Lote de Revisión a un usuario de Control de Calidad (admin only).
 * assignedToId = null quita la asignación.
 */
export async function assignRevisionBatchAction(input: AssignRevisionBatchInput) {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede asignar lotes de revisión." };
    }

    const validated = assignRevisionBatchSchema.parse(input);
    const existing = await prisma.qcRevisionBatch.findUnique({
      where: { id: validated.id },
      select: { id: true, batchNumber: true, assignedToId: true },
    });
    if (!existing) {
      return { success: false, error: "Lote de Revisión no encontrado" };
    }

    const updated = await prisma.qcRevisionBatch.update({
      where: { id: validated.id },
      data: { assignedToId: validated.assignedToId },
    });

    await logAudit({
      userId: persisted.id,
      action: "qc_batch.assign",
      module: "qc",
      entityType: "qc_revision_batch",
      entityId: updated.id,
      beforeData: { assignedToId: existing.assignedToId },
      afterData: { assignedToId: updated.assignedToId },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${updated.id}`);

    return {
      success: true,
      data: updated,
      message: validated.assignedToId
        ? `Lote ${existing.batchNumber} asignado correctamente.`
        : `Asignación del lote ${existing.batchNumber} eliminada.`,
    };
  } catch (error: any) {
    console.error("Error al asignar lote:", error);
    return {
      success: false,
      error: error.message || "Error al asignar el Lote de Revisión",
    };
  }
}

/**
 * Lista los usuarios asignables a lotes (tienen el módulo qc) — admin only.
 */
export async function getQcAssigneesAction() {
  try {
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede ver asignaciones.", data: [] };
    }

    const users = await prisma.user.findMany({
      where: { status: "ACTIVE", allowedModules: { has: "qc" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true, email: true, roleCode: true },
    });

    return { success: true, data: users };
  } catch (error: any) {
    console.error("Error al obtener usuarios asignables:", error);
    return { success: false, error: "Error al obtener los usuarios de Control de Calidad", data: [] };
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
 * Dashboard del Control de Calidad: lotes asignados al usuario + estadísticas.
 * Los administradores se gestionan desde /qc/lotes y no usan este dashboard.
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

    const [lotes, hoyTotal, hoyFuncional, hoyNoFuncional] = await Promise.all([
      prisma.qcRevisionBatch.findMany({
        where: { assignedToId: persisted.id, status: { not: "CANCELLED" } },
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        include: {
          assignedTo: { select: { id: true, name: true, username: true } },
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
    ]);

    let pendientesTotal = 0;
    const lotesConPendientes = lotes.map((l) => {
      const pending = Math.max(0, (l.totalDevices || 0) - (l.reviewedDevices || 0));
      pendientesTotal += pending;
      return { ...l, pendingDevices: pending };
    });

    return {
      success: true,
      data: {
        lotes: lotesConPendientes,
        stats: {
          lotesAsignados: lotes.length,
          pendientesTotal,
          revisadosHoy: hoyTotal,
          aprobadosHoy: hoyFuncional,
          rechazadosHoy: hoyNoFuncional,
        },
        welcome:
          "Recuerda revisar cada detalle minuciosamente. ¡Tu trabajo garantiza la calidad de la mercancía!",
      },
    };
  } catch (error: any) {
    console.error("Error al cargar dashboard QC:", error);
    return { success: false, error: "Error al cargar el panel de Control de Calidad", data: null };
  }
}
