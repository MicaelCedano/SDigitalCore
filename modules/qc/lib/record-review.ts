import type { PrismaClient } from "@prisma/client";
import type { ReviewDeviceInput } from "@/lib/validation/revision-batch";

export class QcCommandError extends Error {
  constructor(
    message: string,
    public code: "QC_CONFLICT" | "QC_FORBIDDEN" | "QC_INVALID"
  ) {
    super(message);
  }
}

/** One transaction for web and mobile: corrections, counters and audit stay together. */
export async function recordReview(
  db: PrismaClient,
  actor: { id: string; name: string; admin: boolean },
  input: ReviewDeviceInput
) {
  return db.$transaction(
    async (tx) => {
      // Serialize reviews in the same lot before calculating its counters.
      const initial = await tx.deviceUnit.findUnique({
        where: { id: input.deviceId },
        select: { batchId: true },
      });
      if (!initial?.batchId)
        throw new QcCommandError(
          "El equipo ya no pertenece a un lote de revisión.",
          "QC_CONFLICT"
        );
      await tx.$queryRaw`SELECT id FROM qc_revision_batch WHERE id = ${initial.batchId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM device_unit WHERE id = ${input.deviceId} FOR UPDATE`;
      const device = await tx.deviceUnit.findUnique({
        where: { id: input.deviceId },
        include: { batch: true },
      });
      if (
        !device?.batch ||
        device.batchId !== initial.batchId ||
        device.batch.status === "CANCELLED"
      )
        throw new QcCommandError(
          "El lote cambió o fue cancelado. Actualiza el equipo.",
          "QC_CONFLICT"
        );
      if (!actor.admin && device.assignedToId !== actor.id)
        throw new QcCommandError(
          "Este IMEI no está asignado a tu usuario.",
          "QC_FORBIDDEN"
        );
      const batch = device.batch;
      if (input.mobile && /-R-[^-]+-/i.test(batch.batchNumber))
        throw new QcCommandError(
          "Este lote solo está disponible para consultar su historial.",
          "QC_CONFLICT"
        );
      if (input.mobile) {
        const previous = await tx.qcInspection.findUnique({
          where: {
            sourceSystem_sourceRecordId: {
              sourceSystem: "MOBILE_V2",
              sourceRecordId: input.mobile.commandId,
            },
          },
        });
        if (previous) {
          if (
            previous.deviceId !== device.id ||
            previous.reviewerId !== actor.id ||
            previous.result !== input.result ||
            previous.grade !== input.grade ||
            previous.functionalityNotes !== (input.notes || null) ||
            previous.batteryHealth !== (input.batteryHealth ?? null)
          )
            throw new QcCommandError(
              "Ese envío pertenece a otra revisión. Actualiza el equipo.",
              "QC_CONFLICT"
            );
          return { batch, replayed: true };
        }
        if (
          input.mobile.expectedBatchId !== batch.id ||
          new Date(input.mobile.expectedUpdatedAt).getTime() !==
            device.updatedAt.getTime()
        )
          throw new QcCommandError(
            "El equipo cambió desde que lo abriste. Actualiza antes de revisar.",
            "QC_CONFLICT"
          );
      }
      const last = await tx.qcInspection.findFirst({
        where: {
          deviceId: device.id,
          status: "COMPLETED",
          createdAt: { gte: batch.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const inspection = await tx.qcInspection.create({
        data: {
          deviceId: device.id,
          reviewerId: actor.id,
          reviewerNameSnapshot: actor.name.slice(0, 160),
          status: "COMPLETED",
          result: input.result,
          grade: input.grade,
          batteryHealth: input.batteryHealth ?? null,
          functionalityNotes: input.notes || null,
          reviewedAt: new Date(),
          supersedesId: last?.id ?? null,
          ...(input.mobile
            ? {
                sourceSystem: "MOBILE_V2",
                sourceRecordId: input.mobile.commandId,
              }
            : {}),
        },
      });
      await tx.deviceUnit.update({
        where: { id: device.id },
        data: {
          status: input.result === "FUNCTIONAL" ? "AVAILABLE" : "QUARANTINED",
        },
      });
      const devices = await tx.deviceUnit.findMany({
        where: { batchId: batch.id },
        include: {
          inspections: {
            where: { createdAt: { gte: batch.createdAt } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      const completed = devices
        .map((d) => d.inspections[0])
        .filter((i) => i?.status === "COMPLETED");
      const nextStatus =
        batch.status === "SUBMITTED"
          ? "SUBMITTED"
          : devices.length > 0 && completed.length >= devices.length
          ? "IN_REVIEW"
          : batch.status;
      const updated = await tx.qcRevisionBatch.update({
        where: { id: batch.id },
        data: {
          reviewedDevices: completed.length,
          functionalCount: completed.filter((i) => i.result === "FUNCTIONAL")
            .length,
          nonFunctionalCount: completed.filter(
            (i) => i.result === "NON_FUNCTIONAL"
          ).length,
          status: nextStatus,
          completedAt: nextStatus === "COMPLETED" ? new Date() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "qc_batch.review_device",
          module: "qc",
          entityType: "qc_inspection",
          entityId: device.id,
          afterData: {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            deviceId: device.id,
            result: input.result,
            grade: input.grade,
            status: updated.status,
            inspectionId: inspection.id,
            ...(input.mobile
              ? {
                  commandId: input.mobile.commandId,
                  checklist: input.mobile.checklist,
                }
              : {}),
          },
        },
      });
      return { batch: updated, replayed: false };
    },
    { timeout: 15000 }
  );
}
