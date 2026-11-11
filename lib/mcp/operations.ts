import type { Prisma, WarrantyStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";
import { equipoSnapshot, garantiaSnapshot, loteSnapshot, tareaSnapshot } from "@/lib/mcp/snapshots";
import {
  assessEquipo,
  assessGarantia,
  assessLote,
  assessSolicitudDecision,
  assessTarea,
  computeVersionHash,
  diffFrom,
  isWriteEntity,
  sameChanges,
  SOLICITUD_ALMACEN_REVERT_ERROR,
  warrantyMove,
  type WriteEntity,
} from "@/lib/mcp/validation";
import { buildWarehouseDecisionPreview } from "@/modules/almacen/lib/warehouse-request-plan";
import { readWarehouseRequestDecision, updateWarehouseRequestStatus } from "@/modules/almacen/lib/warehouse-request-status";
import { applyWarrantyFlowForActor, createEvent, updateWarrantyCaseDetailsForActor } from "@/modules/garantias/actions/warranty";
import { updateDeviceForActor } from "@/modules/qc/actions/device-edit";
import { updateRevisionBatchStatusForActor } from "@/modules/qc/actions/revision-batch";
import { applyWorkTaskPatchForActor } from "@/modules/centro-trabajo/actions/tasks";

const PREVIEW_MS = 15 * 60 * 1000;

function fail(message: string | undefined): never {
  throw new Error(message || "No se pudo aplicar el cambio.");
}

async function loadGarantia(idOCodigo: string) {
  const key = idOCodigo.trim();
  const row = await prisma.warrantyCase.findFirst({
    where: { OR: [{ id: key }, { caseCode: key }, { caseCode: key.toUpperCase() }] },
  });
  if (!row) fail("No se encontró la garantía.");
  return row;
}

async function loadEquipo(idOCodigo: string) {
  const key = idOCodigo.trim();
  const row = await prisma.deviceUnit.findFirst({
    where: { OR: [{ id: key }, { imei: key }, { serialNumber: key }] },
    include: {
      inspections: { where: { status: "COMPLETED" }, orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }], take: 1 },
    },
  });
  if (!row) fail("No se encontró el equipo.");
  return row;
}

async function loadLote(idOCodigo: string) {
  const key = idOCodigo.trim();
  const row = await prisma.qcRevisionBatch.findFirst({ where: { OR: [{ id: key }, { batchNumber: key }] } });
  if (!row) fail("No se encontró el lote QC.");
  return row;
}

async function loadTarea(idOCodigo: string) {
  const row = await prisma.workTask.findUnique({ where: { id: idOCodigo.trim() } });
  if (!row) fail("No se encontró la tarea.");
  return row;
}

function snapshotOf(entidad: WriteEntity, row: Awaited<ReturnType<typeof loadEntity>>): Record<string, unknown> {
  if (entidad === "solicitud_almacen") return (row as { snapshot: Record<string, unknown> }).snapshot;
  if (entidad === "garantia") return garantiaSnapshot(row as Awaited<ReturnType<typeof loadGarantia>>);
  if (entidad === "equipo_qc") return equipoSnapshot(row as Awaited<ReturnType<typeof loadEquipo>>);
  if (entidad === "lote_qc") return loteSnapshot(row as Awaited<ReturnType<typeof loadLote>>);
  return tareaSnapshot(row as Awaited<ReturnType<typeof loadTarea>>);
}

async function loadEntity(entidad: WriteEntity, idOCodigo: string) {
  if (entidad === "solicitud_almacen") {
    const loaded = await readWarehouseRequestDecision(idOCodigo);
    if (!loaded) fail("No se encontró la solicitud de almacén.");
    return loaded;
  }
  if (entidad === "garantia") return loadGarantia(idOCodigo);
  if (entidad === "equipo_qc") return loadEquipo(idOCodigo);
  if (entidad === "lote_qc") return loadLote(idOCodigo);
  return loadTarea(idOCodigo);
}

function assess(entidad: WriteEntity, row: Awaited<ReturnType<typeof loadEntity>>, propuesta: Record<string, unknown>) {
  if (entidad === "solicitud_almacen") {
    return { ok: false, errors: ["La solicitud de almacén se valida con su inventario en preparar_cambios."], warnings: [], cambios: {} };
  }
  if (entidad === "garantia") {
    const current = row as Awaited<ReturnType<typeof loadGarantia>>;
    return assessGarantia(
      {
        status: current.status,
        archivedAt: current.archivedAt ? current.archivedAt.toISOString() : null,
        cliente: current.clientName,
        modelo: current.model,
        color: current.color,
        imei: current.imei,
        problema: current.problem,
      },
      propuesta,
    );
  }
  if (entidad === "equipo_qc") {
    const current = row as Awaited<ReturnType<typeof loadEquipo>>;
    return assessEquipo(
      {
        marca: current.brand,
        modelo: current.model,
        almacenamientoGb: current.storageGb,
        color: current.color,
        resultado: current.inspections[0]?.result ?? null,
      },
      propuesta,
    );
  }
  if (entidad === "lote_qc") {
    const current = row as Awaited<ReturnType<typeof loadLote>>;
    if (current.status === "SUBMITTED" || current.status === "COMPLETED") {
      return { ok: false, errors: ["Ese lote ya está en un estado de pago y no se edita por el MCP."], warnings: [], cambios: {} };
    }
    return assessLote({ estado: current.status, notas: current.notes }, propuesta);
  }
  const current = row as Awaited<ReturnType<typeof loadTarea>>;
  return assessTarea(
    {
      titulo: current.title,
      descripcion: current.description,
      prioridad: current.priority,
      vence: current.dueAt ? current.dueAt.toISOString().slice(0, 10) : null,
      estado: current.status,
      kind: current.kind,
    },
    propuesta,
  );
}

async function applyChange(actor: McpActor, entidad: WriteEntity, idOCodigo: string, cambios: Record<string, unknown>) {
  if (entidad === "solicitud_almacen") {
    if (actor.roleCode !== "ADMIN") fail("Solo un administrador puede aprobar o rechazar solicitudes de almacén.");
    const decision = cambios.estado === "APPROVED" || cambios.estado === "REJECTED" ? cambios.estado : null;
    if (!decision) fail("La decisión no es válida.");
    const loaded = await readWarehouseRequestDecision(idOCodigo);
    if (!loaded) fail("No se encontró la solicitud de almacén.");
    await updateWarehouseRequestStatus({ id: loaded.request.id, status: decision, actorId: actor.id, source: "mcp" });
    return;
  }
  if (entidad === "garantia") {
    const row = await loadGarantia(idOCodigo);
    const fields = ["cliente", "modelo", "color", "imei", "problema"].some((key) => key in cambios);
    if (fields) {
      const updated = await updateWarrantyCaseDetailsForActor(actor, {
        caseCode: row.caseCode,
        clientName: (cambios.cliente as string | undefined) ?? row.clientName,
        model: (cambios.modelo as string | undefined) ?? row.model,
        imei: (cambios.imei as string | undefined) ?? row.imei,
        problem: (cambios.problema as string | undefined) ?? row.problem,
        ...("color" in cambios ? { color: (cambios.color as string | null) ?? "" } : {}),
      });
      if (!updated.success) fail(updated.error);
    }
    if (typeof cambios.estado === "string" && cambios.estado !== row.status) {
      const fresh = await loadGarantia(row.caseCode);
      const move = warrantyMove(fresh.status, cambios.estado as WarrantyStatus);
      if (!move) fail("La transición ya no es válida.");
      if (move.kind === "flow") {
        const result = await applyWarrantyFlowForActor(
          actor,
          {
            caseCodes: [fresh.caseCode],
            counterpartyName: typeof cambios.contraparte === "string" ? cambios.contraparte : undefined,
            technicianId: typeof cambios.tecnicoId === "string" ? cambios.tecnicoId : undefined,
            reason: typeof cambios.motivo === "string" ? cambios.motivo : undefined,
          },
          move.operation,
        );
        if (!result.success) fail(result.error);
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.warrantyCase.update({
            where: { id: fresh.id },
            data: { status: cambios.estado as WarrantyStatus, updatedById: actor.id },
          });
          await createEvent(tx, fresh.id, actor, "STATUS_CHANGED", {
            fromStatus: fresh.status,
            toStatus: cambios.estado as WarrantyStatus,
            reason: typeof cambios.motivo === "string" ? cambios.motivo : "Cambio de estado por MCP",
          });
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              action: "warranty.status.mcp",
              module: "garantias",
              entityType: "WarrantyCase",
              entityId: fresh.id,
              beforeData: { status: fresh.status },
              afterData: { status: cambios.estado as WarrantyStatus },
            },
          });
        });
      }
    }
    return;
  }

  if (entidad === "equipo_qc") {
    const row = await loadEquipo(idOCodigo);
    const resultado = (cambios.resultado as "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | undefined) ?? row.inspections[0]?.result ?? null;
    if (!resultado) {
      await prisma.deviceUnit.update({
        where: { id: row.id },
        data: {
          brand: "marca" in cambios ? (cambios.marca as string | null) : row.brand,
          model: (cambios.modelo as string | undefined) ?? row.model,
          storageGb: "almacenamientoGb" in cambios ? (cambios.almacenamientoGb as number | null) : row.storageGb,
          color: "color" in cambios ? (cambios.color as string | null) : row.color,
        },
      });
      await logAudit({
        userId: actor.id,
        action: "qc.device.update",
        module: "qc",
        entityType: "device_unit",
        entityId: row.id,
        beforeData: { brand: row.brand, model: row.model, storageGb: row.storageGb, color: row.color },
        afterData: cambios as Prisma.InputJsonObject,
      });
      return;
    }
    const result = await updateDeviceForActor(actor.id, {
      deviceId: row.id,
      brand: "marca" in cambios ? (cambios.marca as string | null) ?? undefined : row.brand ?? undefined,
      model: (cambios.modelo as string | undefined) ?? row.model,
      storageGb: "almacenamientoGb" in cambios ? (cambios.almacenamientoGb as number | null) : row.storageGb,
      color: "color" in cambios ? (cambios.color as string | null) ?? undefined : row.color ?? undefined,
      result: resultado,
    });
    if (!result.success) fail(result.error);
    return;
  }

  if (entidad === "lote_qc") {
    const row = await loadLote(idOCodigo);
    const status = (cambios.estado as "DRAFT" | "PENDING_REVIEW" | "IN_REVIEW" | "CANCELLED" | undefined) ?? row.status;
    if (status === "SUBMITTED" || status === "COMPLETED") fail("Ese estado de lote no se puede aplicar por el MCP.");
    const result = await updateRevisionBatchStatusForActor(actor.id, {
      id: row.id,
      status: status as "DRAFT" | "PENDING_REVIEW" | "IN_REVIEW" | "CANCELLED",
      notes: "notas" in cambios ? (cambios.notas as string | null) : row.notes,
    });
    if (!result.success) fail(result.error);
    return;
  }

  const row = await loadTarea(idOCodigo);
  const result = await applyWorkTaskPatchForActor(actor, row.id, {
    ...("titulo" in cambios ? { titulo: cambios.titulo } : {}),
    ...("descripcion" in cambios ? { descripcion: cambios.descripcion } : {}),
    ...("prioridad" in cambios ? { prioridad: cambios.prioridad } : {}),
    ...("vence" in cambios ? { vence: cambios.vence } : {}),
    ...("estado" in cambios ? { estado: cambios.estado } : {}),
    ...("comentario" in cambios ? { comentario: cambios.comentario } : {}),
  });
  return result;
}

async function restore(actor: McpActor, entidad: WriteEntity, idOCodigo: string, before: Record<string, unknown>, after: Record<string, unknown> | null) {
  if (entidad === "solicitud_almacen") fail(SOLICITUD_ALMACEN_REVERT_ERROR);
  if (entidad === "garantia") {
    const row = await loadGarantia(idOCodigo);
    await prisma.$transaction(async (tx) => {
      await tx.warrantyCase.update({
        where: { id: row.id },
        data: {
          clientName: String(before.cliente),
          model: String(before.modelo),
          color: (before.color as string | null) ?? null,
          imei: String(before.imei),
          problem: String(before.problema),
          status: before.estado as WarrantyStatus,
          assignedTechnicianId: (before.tecnicoId as string | null) ?? null,
          assignedTechnicianName: (before.tecnicoNombre as string | null) ?? null,
          currentSupplierName: (before.suplidor as string | null) ?? null,
          updatedById: actor.id,
        },
      });
      await createEvent(tx, row.id, actor, "DETAILS_UPDATED", {
        fromStatus: row.status,
        toStatus: before.estado as WarrantyStatus,
        reason: "Reversión MCP",
        beforeData: { status: row.status },
        afterData: { status: before.estado },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "mcp.revertir",
          module: "mcp",
          entityType: "garantia",
          entityId: row.id,
          beforeData: { estado: row.status } as Prisma.InputJsonObject,
          afterData: { estado: before.estado } as Prisma.InputJsonObject,
        },
      });
    });
    return;
  }
  if (entidad === "equipo_qc") {
    const row = await loadEquipo(idOCodigo);
    const resultado = before.resultado as "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | null;
    if (!resultado) {
      await prisma.deviceUnit.update({
        where: { id: row.id },
        data: {
          brand: (before.marca as string | null) ?? null,
          model: String(before.modelo),
          storageGb: (before.almacenamientoGb as number | null) ?? null,
          color: (before.color as string | null) ?? null,
          status: before.estadoOperativo as never,
        },
      });
    } else {
      const result = await updateDeviceForActor(actor.id, {
        deviceId: row.id,
        brand: (before.marca as string | null) ?? undefined,
        model: String(before.modelo),
        storageGb: (before.almacenamientoGb as number | null) ?? null,
        color: (before.color as string | null) ?? undefined,
        result: resultado,
      });
      if (!result.success) fail(result.error);
    }
    await logAudit({ userId: actor.id, action: "mcp.revertir", module: "mcp", entityType: "equipo_qc", entityId: row.id, afterData: before as Prisma.InputJsonObject });
    return;
  }
  if (entidad === "lote_qc") {
    const row = await loadLote(idOCodigo);
    const status = before.estado as "DRAFT" | "PENDING_REVIEW" | "IN_REVIEW" | "CANCELLED";
    const result = await updateRevisionBatchStatusForActor(actor.id, {
      id: row.id,
      status,
      notes: (before.notas as string | null) ?? null,
    });
    if (!result.success) fail(result.error);
    await logAudit({ userId: actor.id, action: "mcp.revertir", module: "mcp", entityType: "lote_qc", entityId: row.id, afterData: { estado: status } });
    return;
  }
  const row = await loadTarea(idOCodigo);
  await applyWorkTaskPatchForActor(actor, row.id, {
    titulo: before.titulo,
    descripcion: before.descripcion,
    prioridad: before.prioridad,
    vence: before.vence,
    estado: before.estado,
  });
  const commentEventId = typeof after?.commentEventId === "string" ? after.commentEventId : null;
  if (commentEventId) {
    await prisma.workTaskEvent.deleteMany({ where: { id: commentEventId, taskId: row.id, type: "COMMENTED" } });
  }
  await logAudit({ userId: actor.id, action: "mcp.revertir", module: "mcp", entityType: "tarea", entityId: row.id, afterData: before as Prisma.InputJsonObject });
}

async function prepararDecisionAlmacen(actor: McpActor, idOCodigo: string, propuesta: Record<string, unknown>, justificacion?: string) {
  if (actor.roleCode !== "ADMIN") fail("Solo un administrador puede aprobar o rechazar solicitudes de almacén.");
  const loaded = await readWarehouseRequestDecision(idOCodigo);
  if (!loaded) fail("No se encontró la solicitud de almacén.");
  const shape = assessSolicitudDecision(propuesta);
  const decision = shape.cambios.estado === "APPROVED" || shape.cambios.estado === "REJECTED" ? shape.cambios.estado : null;
  const solicitud = {
    id: loaded.request.id,
    codigo: loaded.request.requestCode,
    titulo: loaded.request.title,
    sucursal: loaded.request.branch,
    solicitado_por: loaded.request.requestedBy,
    tipo: loaded.request.type,
    estado: loaded.request.status,
  };
  if (!shape.ok || !decision) {
    return {
      rechazado: true,
      entidad: "solicitud_almacen" as const,
      id: loaded.snapshot.id,
      codigo: loaded.snapshot.codigo,
      errores: shape.errors,
      advertencias: shape.warnings,
      vista_previa: { solicitud, decision: null, items: [], errores: shape.errors, advertencias: shape.warnings },
      resumen: shape.errors.join(" "),
    };
  }
  const preview = buildWarehouseDecisionPreview(loaded.request, decision);
  if (!preview.ok) {
    return {
      rechazado: true,
      entidad: "solicitud_almacen" as const,
      id: preview.snapshot.id,
      codigo: preview.snapshot.codigo,
      errores: preview.errores,
      advertencias: [...shape.warnings, ...preview.advertencias],
      vista_previa: preview.vista,
      resumen: preview.errores.join(" "),
    };
  }
  const versionHash = computeVersionHash(preview.snapshot);
  const created = await prisma.mcpOperacion.create({
    data: {
      entidad: "solicitud_almacen",
      entityId: String(preview.snapshot.id),
      versionHashAntes: versionHash,
      propuesta: { cambios: preview.cambios, original: propuesta, vista_previa: preview.vista } as Prisma.InputJsonObject,
      diff: diffFrom(preview.snapshot, preview.cambios) as unknown as Prisma.InputJsonValue,
      snapshotAntes: preview.snapshot as Prisma.InputJsonObject,
      justificacion: justificacion?.slice(0, 1000) || null,
      actorUserId: actor.id,
      expiresAt: new Date(Date.now() + PREVIEW_MS),
    },
  });
  return {
    operacion_id: created.id,
    entidad: "solicitud_almacen" as const,
    id: preview.snapshot.id,
    codigo: preview.snapshot.codigo,
    version_hash: versionHash,
    diff: created.diff,
    cambios: preview.cambios,
    advertencias: [...shape.warnings, ...preview.advertencias],
    vista_previa: preview.vista,
    requiere_confirmacion_usuario: true,
    expira_en: created.expiresAt.toISOString(),
    resumen: decision === "REJECTED"
      ? "No se escribió nada. El rechazo no mueve inventario. Muestra la vista previa y confirma con confirmar_cambios y aprobacion_explicita true."
      : "No se escribió nada. Revisa el stock actual y el resultante. Confirma con confirmar_cambios y aprobacion_explicita true.",
  };
}

export async function prepararCambios(entidad: string, idOCodigo: string, propuesta: Record<string, unknown>, justificacion?: string) {
  if (!isWriteEntity(entidad)) fail("Esa entidad no admite escritura en esta versión.");
  const actor = await requireMcpActor();
  if (entidad === "solicitud_almacen") return prepararDecisionAlmacen(actor, idOCodigo, propuesta, justificacion);
  const row = await loadEntity(entidad, idOCodigo);
  const reviewed = assess(entidad, row, propuesta);
  if (!reviewed.ok) fail(reviewed.errors.join(" "));
  const snapshot = snapshotOf(entidad, row as never);
  const versionHash = computeVersionHash(snapshot);
  const created = await prisma.mcpOperacion.create({
    data: {
      entidad,
      entityId: String(snapshot.id),
      versionHashAntes: versionHash,
      propuesta: { cambios: reviewed.cambios, original: propuesta } as Prisma.InputJsonObject,
      diff: diffFrom(snapshot, reviewed.cambios) as unknown as Prisma.InputJsonValue,
      snapshotAntes: snapshot as Prisma.InputJsonObject,
      justificacion: justificacion?.slice(0, 1000) || null,
      actorUserId: actor.id,
      expiresAt: new Date(Date.now() + PREVIEW_MS),
    },
  });
  return {
    operacion_id: created.id,
    entidad,
    id: snapshot.id,
    codigo: "codigo" in snapshot ? snapshot.codigo : snapshot.id,
    version_hash: versionHash,
    diff: created.diff,
    cambios: reviewed.cambios,
    advertencias: reviewed.warnings,
    requiere_confirmacion_usuario: true,
    expira_en: created.expiresAt.toISOString(),
    resumen: "No se escribió nada. Confirma con confirmar_cambios y aprobacion_explicita true.",
  };
}

export async function confirmarCambios(input: {
  entidad: string;
  idOCodigo: string;
  operacionId: string;
  versionHash: string;
  cambiosAprobados: Record<string, unknown>;
  aprobacionExplicita: boolean;
}) {
  if (!input.aprobacionExplicita) fail("Se requiere aprobacion_explicita true después de que el usuario confirme.");
  if (!isWriteEntity(input.entidad)) fail("Esa entidad no admite escritura en esta versión.");
  const actor = await requireMcpActor();
  const operacion = await prisma.mcpOperacion.findUnique({ where: { id: input.operacionId } });
  if (!operacion || operacion.entidad !== input.entidad) fail("No existe esa operación.");
  if (operacion.estado !== "PENDIENTE") fail(`La operación está ${operacion.estado.toLowerCase()} y no se puede confirmar.`);
  if (operacion.expiresAt.getTime() < Date.now()) {
    await prisma.mcpOperacion.update({ where: { id: operacion.id }, data: { estado: "EXPIRADA" } });
    fail("La operación expiró. Vuelve a preparar los cambios.");
  }
  const stored = operacion.propuesta as { cambios?: Record<string, unknown> };
  const cambios = stored.cambios ?? {};
  if (!sameChanges(cambios, input.cambiosAprobados)) fail("cambios_aprobados no coincide con el preview.");
  const row = await loadEntity(input.entidad, input.idOCodigo);
  const snapshot = snapshotOf(input.entidad, row as never);
  if (String(snapshot.id) !== operacion.entityId) fail("La operación no corresponde a ese registro.");
  const versionHash = computeVersionHash(snapshot);
  if (versionHash !== operacion.versionHashAntes || versionHash !== input.versionHash) {
    if (input.entidad === "solicitud_almacen") {
      const decision = cambios.estado;
      if (decision === "APPROVED" || decision === "REJECTED") {
        const loadedNow = await readWarehouseRequestDecision(input.idOCodigo);
        if (!loadedNow) fail("No se encontró la solicitud de almacén.");
        const preview = buildWarehouseDecisionPreview(loadedNow.request, decision);
        if (!preview.ok) fail(preview.errores.join(" "));
      }
      fail("La solicitud o el stock cambiaron desde el preview. Vuelve a preparar los cambios.");
    }
    fail("El registro cambió desde el preview. Vuelve a leerlo y a preparar los cambios.");
  }
  const applied = await applyChange(actor, input.entidad, input.idOCodigo, cambios);
  const fresh = await loadEntity(input.entidad, input.idOCodigo);
  const after = snapshotOf(input.entidad, fresh as never);
  const commentEventId = applied && typeof applied === "object" && "commentEventId" in applied ? applied.commentEventId : null;
  const snapshotDespues = { ...after, ...(commentEventId ? { commentEventId } : {}) };
  await prisma.mcpOperacion.update({
    where: { id: operacion.id },
    data: {
      estado: "APLICADA",
      versionHashDespues: computeVersionHash(after),
      snapshotDespues: snapshotDespues as Prisma.InputJsonObject,
      appliedAt: new Date(),
    },
  });
  await logAudit({
    userId: actor.id,
    action: "mcp.confirmar",
    module: "mcp",
    entityType: input.entidad,
    entityId: operacion.entityId,
    beforeData: snapshot as Prisma.InputJsonObject,
    afterData: { operacionId: operacion.id, cambios } as Prisma.InputJsonObject,
  });
  return {
    exito: true,
    operacion_id: operacion.id,
    entidad: input.entidad,
    id: after.id,
    version_hash: computeVersionHash(after),
    campos_actualizados: Object.keys(cambios),
    mensaje: input.entidad === "solicitud_almacen"
      ? (cambios.estado === "REJECTED" ? "Solicitud rechazada. No se movió inventario." : "Solicitud aprobada. El inventario quedó actualizado.")
      : "Cambios guardados.",
  };
}

export async function verificarCambios(entidad: string, idOCodigo: string, operacionId?: string, camposEsperados?: Record<string, unknown>) {
  if (!isWriteEntity(entidad)) fail("Esa entidad no admite verificación de escritura.");
  const row = await loadEntity(entidad, idOCodigo);
  const snapshot = snapshotOf(entidad, row as never);
  const operacion = operacionId ? await prisma.mcpOperacion.findUnique({ where: { id: operacionId } }) : null;
  const expected = camposEsperados ?? ((operacion?.propuesta as { cambios?: Record<string, unknown> } | undefined)?.cambios ?? {});
  const campos = Object.keys(expected).sort();
  const detalles = campos.filter((campo) => campo in snapshot).map((campo) => {
    const guardado = snapshot[campo] ?? null;
    return { campo, esperado: expected[campo], guardado, coincide: stableEnough(expected[campo], guardado) };
  });
  const instrucciones = campos.filter((campo) => !(campo in snapshot));
  const hash = computeVersionHash(snapshot);
  const coincide = detalles.every((item) => item.coincide);
  return {
    exito: coincide && (!operacion || operacion.estado === "APLICADA"),
    operacion_id: operacion?.id,
    estado_operacion: operacion?.estado ?? null,
    entidad,
    id: snapshot.id,
    version_hash: hash,
    verificado: coincide,
    detalles,
    instrucciones_no_guardadas_como_columna: instrucciones,
    resumen: coincide
      ? "Los campos persistidos coinciden con lo esperado."
      : "Hay campos que no coinciden.",
  };
}

function stableEnough(expected: unknown, actual: unknown) {
  if (expected === actual) return true;
  return JSON.stringify(expected) === JSON.stringify(actual);
}

export async function revertirCambios(entidad: string, idOCodigo: string, operacionId: string, aprobacionExplicita: boolean) {
  if (entidad === "solicitud_almacen") fail(SOLICITUD_ALMACEN_REVERT_ERROR);
  if (!aprobacionExplicita) fail("Se requiere aprobacion_explicita true para revertir.");
  if (!isWriteEntity(entidad)) fail("Esa entidad no admite reversión.");
  const actor = await requireMcpActor();
  const operacion = await prisma.mcpOperacion.findUnique({ where: { id: operacionId } });
  if (!operacion || operacion.entidad !== entidad) fail("No existe esa operación.");
  if (operacion.estado !== "APLICADA") fail("Solo se puede revertir una operación aplicada.");
  const row = await loadEntity(entidad, idOCodigo);
  const snapshot = snapshotOf(entidad, row as never);
  if (String(snapshot.id) !== operacion.entityId) fail("La operación no corresponde a ese registro.");
  if (!operacion.versionHashDespues || computeVersionHash(snapshot) !== operacion.versionHashDespues) {
    fail("El registro cambió después de esa operación. No se revierte para no pisar cambios posteriores.");
  }
  const before = operacion.snapshotAntes as Record<string, unknown>;
  const after = (operacion.snapshotDespues as Record<string, unknown> | null) ?? null;
  await restore(actor, entidad, idOCodigo, before, after);
  const fresh = await loadEntity(entidad, idOCodigo);
  const restored = snapshotOf(entidad, fresh as never);
  const reversion = await prisma.mcpOperacion.create({
    data: {
      entidad,
      entityId: operacion.entityId,
      versionHashAntes: operacion.versionHashDespues,
      versionHashDespues: computeVersionHash(restored),
      propuesta: { reversionDe: operacion.id } as Prisma.InputJsonObject,
      diff: diffFrom(snapshot, before) as unknown as Prisma.InputJsonValue,
      snapshotAntes: snapshot as Prisma.InputJsonObject,
      snapshotDespues: restored as Prisma.InputJsonObject,
      estado: "APLICADA",
      actorUserId: actor.id,
      reversaDeId: operacion.id,
      expiresAt: new Date(),
      appliedAt: new Date(),
    },
  });
  await prisma.mcpOperacion.update({ where: { id: operacion.id }, data: { estado: "REVERTIDA", revertedAt: new Date() } });
  return {
    exito: true,
    operacion_id_revertida: operacion.id,
    reversion_operacion_id: reversion.id,
    entidad,
    id: restored.id,
    version_hash: computeVersionHash(restored),
    mensaje: "Se restauró el snapshot anterior. Los documentos ya emitidos de una garantía no se borran.",
  };
}
