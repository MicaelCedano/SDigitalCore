"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  createImeiRequestSchema,
  resolveImeiRequestSchema,
  CreateImeiRequestInput,
  ResolveImeiRequestInput,
} from "@/lib/validation/imei-requests";

/**
 * El QC solicita IMEIs que quiere revisar (fórmula SDigitalSystem).
 * Solo se aceptan equipos existentes, en lotes no cancelados y libres
 * (no asignados a otro QC).
 */
export async function createImeiRequestAction(input: CreateImeiRequestInput) {
  try {
    const user = await requirePermission("qc.write");
    if (!user.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const validated = createImeiRequestSchema.parse(input);
    const imeis = Array.from(new Set(validated.imeis.map((i) => i.trim()).filter(Boolean)));

    const devices = await prisma.deviceUnit.findMany({
      where: { imei: { in: imeis }, batch: { status: { not: "CANCELLED" } } },
      select: { id: true, imei: true, model: true, assignedToId: true },
    });
    const deviceByImei = new Map(devices.map((d) => [d.imei, d]));

    const notFound = imeis.filter((i) => !deviceByImei.has(i));
    const alreadyAssigned = imeis.filter((i) => {
      const d = deviceByImei.get(i);
      return d && d.assignedToId && d.assignedToId !== user.id;
    });
    const validImeis = imeis.filter((i) => {
      const d = deviceByImei.get(i);
      return d && (!d.assignedToId || d.assignedToId === user.id);
    });

    if (validImeis.length === 0) {
      return {
        success: false,
        error:
          "Ninguno de los IMEIs es válido para solicitar" +
          (notFound.length > 0 ? " (algunos no existen en el sistema)" : "") +
          (alreadyAssigned.length > 0 ? " (otros ya están asignados a otro QC)" : "") +
          ".",
      };
    }

    const payload = validImeis.map((imei) => ({
      imei,
      model: deviceByImei.get(imei)!.model || null,
    }));

    const request = await prisma.qcImeiRequest.create({
      data: {
        requesterId: user.id,
        imeis: payload,
        status: "PENDING",
      },
    });

    await logAudit({
      userId: user.id,
      action: "qc_imei_request.create",
      module: "qc",
      entityType: "qc_imei_request",
      entityId: request.id,
      afterData: { count: validImeis.length, imeis: validImeis },
    });

    revalidatePath("/qc");

    return {
      success: true,
      data: request,
      message:
        `Solicitud enviada con ${validImeis.length} IMEI(s).` +
        (notFound.length > 0 ? ` Se omitieron ${notFound.length} que no existen.` : "") +
        (alreadyAssigned.length > 0 ? ` Se omitieron ${alreadyAssigned.length} ya asignados a otro QC.` : ""),
    };
  } catch (error: any) {
    console.error("Error al crear solicitud de IMEIs:", error);
    return {
      success: false,
      error: error.message || "Error al enviar la solicitud de IMEIs",
    };
  }
}

/**
 * Validación en vivo para el modal del QC: clasifica cada IMEI pegado como
 * disponible, inexistente o asignado a otro QC (misma regla que
 * createImeiRequestAction). No muta nada — solo informa al QC antes de enviar.
 */
export async function validateImeisAction(input: { imeis: string[] }) {
  try {
    const user = await requirePermission("qc.write");
    if (!user.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable.", data: [] };
    }

    const imeis = Array.from(
      new Set((input.imeis || []).map((i) => i.trim()).filter((i) => i.length >= 4))
    ).slice(0, 1000);

    if (imeis.length === 0) return { success: true, data: [] };

    const devices = await prisma.deviceUnit.findMany({
      where: { imei: { in: imeis }, batch: { status: { not: "CANCELLED" } } },
      select: { imei: true, assignedToId: true },
    });
    const deviceByImei = new Map(devices.map((d) => [d.imei, d]));

    const data = imeis.map((imei) => {
      const device = deviceByImei.get(imei);
      if (!device) return { imei, status: "not_found" as const };
      if (device.assignedToId && device.assignedToId !== user.id) {
        return { imei, status: "assigned" as const };
      }
      return { imei, status: "ok" as const };
    });

    return { success: true, data };
  } catch (error: any) {
    console.error("Error al validar IMEIs:", error);
    return { success: false, error: error.message || "Error al validar los IMEIs", data: [] };
  }
}

/**
 * Solicitudes del QC actual (las suyas, con estado).
 */
export async function getMyImeiRequestsAction() {
  try {
    const user = await requirePermission("qc.read");
    if (!user.id) return { success: false, error: "Sesión no identificable.", data: [] };

    const requests = await prisma.qcImeiRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { success: true, data: requests };
  } catch (error: any) {
    console.error("Error al consultar mis solicitudes:", error);
    return { success: false, error: "Error al consultar las solicitudes", data: [] };
  }
}

/**
 * Solicitudes pendientes para el admin, con estado en vivo de cada IMEI.
 */
export async function getPendingImeiRequestsAction() {
  try {
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede ver solicitudes pendientes.", data: [] };
    }

    const requests = await prisma.qcImeiRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        requester: { select: { id: true, name: true, username: true } },
      },
    });

    // Estado en vivo de los IMEIs solicitados
    const allImeis = Array.from(new Set(requests.flatMap((r) => (Array.isArray(r.imeis) ? r.imeis.map((i: any) => i.imei) : []))));
    const devices = await prisma.deviceUnit.findMany({
      where: { imei: { in: allImeis } },
      select: { imei: true, status: true, assignedToId: true },
    });
    const deviceByImei = new Map(devices.map((d) => [d.imei, d]));

    const enriched = requests.map((r) => ({
      ...r,
      imeis: (Array.isArray(r.imeis) ? r.imeis : []).map((i: any) => ({
        ...i,
        currentStatus: deviceByImei.get(i.imei)?.status ?? null,
        currentAssignedToId: deviceByImei.get(i.imei)?.assignedToId ?? null,
      })),
    }));

    return { success: true, data: enriched };
  } catch (error: any) {
    console.error("Error al consultar solicitudes pendientes:", error);
    return { success: false, error: "Error al consultar las solicitudes", data: [] };
  }
}

/**
 * El admin acepta o rechaza una solicitud de IMEIs. Al aceptar, los IMEIs
 * quedan asignados al QC solicitante (estado IN_QC) — misma fórmula que System.
 */
export async function resolveImeiRequestAction(input: ResolveImeiRequestInput) {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede procesar solicitudes." };
    }

    const validated = resolveImeiRequestSchema.parse(input);
    const request = await prisma.qcImeiRequest.findUnique({ where: { id: validated.id } });
    if (!request) {
      return { success: false, error: "Solicitud no encontrada." };
    }
    if (request.status !== "PENDING") {
      return { success: false, error: "La solicitud ya fue procesada." };
    }

    const imeis: { imei: string }[] = Array.isArray(request.imeis)
      ? (request.imeis as { imei: string }[])
      : [];
    let assigned = 0;

    if (validated.accept) {
      const devices = await prisma.deviceUnit.findMany({
        where: { imei: { in: imeis.map((i) => i.imei) } },
        select: { id: true, imei: true, assignedToId: true },
      });
      const free = devices.filter((d) => !d.assignedToId || d.assignedToId === request.requesterId);
      if (free.length > 0) {
        const res = await prisma.deviceUnit.updateMany({
          where: { id: { in: free.map((d) => d.id) } },
          data: { assignedToId: request.requesterId, status: "IN_QC" },
        });
        assigned = res.count;
      }
    }

    const updated = await prisma.qcImeiRequest.update({
      where: { id: request.id },
      data: {
        status: validated.accept ? "ACCEPTED" : "REJECTED",
        acceptedBy: validated.accept ? persisted.id : null,
        resolvedAt: new Date(),
      },
    });

    await logAudit({
      userId: persisted.id,
      action: validated.accept ? "qc_imei_request.accept" : "qc_imei_request.reject",
      module: "qc",
      entityType: "qc_imei_request",
      entityId: request.id,
      afterData: { imeiCount: imeis.length, assignedDevices: assigned },
    });

    revalidatePath("/qc");
    revalidatePath("/qc/solicitudes");

    return {
      success: true,
      data: updated,
      message: validated.accept
        ? `Solicitud aceptada: ${assigned} IMEI(s) asignados al QC.`
        : "Solicitud rechazada.",
    };
  } catch (error: any) {
    console.error("Error al procesar solicitud:", error);
    return {
      success: false,
      error: error.message || "Error al procesar la solicitud",
    };
  }
}

/**
 * El admin asigna un IMEI directo a un QC (o lo desasigna con qcId = null).
 * Misma fórmula que assignToQualityControl de SDigitalSystem.
 */
export async function assignDeviceToQcAction(deviceId: string, qcId: string | null) {
  try {
    const actor = await requirePermission("qc.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted || persisted.roleCode !== "ADMIN") {
      return { success: false, error: "Solo el administrador puede asignar IMEIs." };
    }

    const device = await prisma.deviceUnit.findUnique({
      where: { id: deviceId },
      select: { id: true, imei: true, assignedToId: true, batchId: true },
    });
    if (!device) {
      return { success: false, error: "Equipo no encontrado." };
    }

    let message = "Asignación eliminada.";
    if (qcId) {
      if (device.assignedToId && device.assignedToId !== qcId) {
        return { success: false, error: "Este IMEI ya está asignado a otro QC." };
      }
      const qc = await prisma.user.findUnique({
        where: { id: qcId },
        select: { id: true, allowedModules: true, status: true },
      });
      if (!qc || qc.status !== "ACTIVE" || !qc.allowedModules.includes("qc")) {
        return { success: false, error: "El usuario QC seleccionado no es válido." };
      }
      message = "IMEI asignado al QC correctamente.";
    }

    const updated = await prisma.deviceUnit.update({
      where: { id: deviceId },
      data: {
        assignedToId: qcId || null,
        status: qcId ? "IN_QC" : "PENDING_QC",
      },
    });

    await logAudit({
      userId: persisted.id,
      action: qcId ? "qc_device.assign" : "qc_device.unassign",
      module: "qc",
      entityType: "device_unit",
      entityId: device.id,
      beforeData: { assignedToId: device.assignedToId },
      afterData: { assignedToId: qcId, imei: device.imei },
    });

    revalidatePath("/qc/lotes");
    revalidatePath(`/qc/lotes/${device.batchId}`);
    revalidatePath("/qc");

    return { success: true, data: updated, message };
  } catch (error: any) {
    console.error("Error al asignar IMEI:", error);
    return {
      success: false,
      error: error.message || "Error al asignar el IMEI",
    };
  }
}

/**
 * Lista de usuarios QC asignables (tienen el módulo qc) — admin only.
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
