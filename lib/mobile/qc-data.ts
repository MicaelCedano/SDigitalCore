import { prisma } from "@/lib/db/prisma";
import { can, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getDeviceHistoryAction } from "@/modules/qc/actions/device-history";
import type { QcDetail, QcDevice, QcPage } from "./qc-contract";
import type { Prisma } from "@prisma/client";

const select = {
  id: true,
  imei: true,
  serialNumber: true,
  brand: true,
  model: true,
  updatedAt: true,
  assignedToId: true,
  batchId: true,
  assignedTo: { select: { name: true } },
  batch: {
    select: { id: true, batchNumber: true, status: true, createdAt: true },
  },
  inspections: {
    where: { status: "COMPLETED" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { result: true, createdAt: true },
  },
} satisfies Prisma.DeviceUnitSelect;
type Device = Prisma.DeviceUnitGetPayload<{ select: typeof select }>;
type Actor = NonNullable<Awaited<ReturnType<typeof getPersistedCurrentUser>>>;
export function qcDeviceDTO(
  device: Device,
  actor: Actor,
  write: boolean
): QcDevice {
  const inspection = device.inspections[0];
  return {
    id: device.id,
    imei: device.imei || device.serialNumber || "Sin IMEI",
    model: [device.brand, device.model].filter(Boolean).join(" ") || "Equipo",
    updatedAt: device.updatedAt.toISOString(),
    batchId: device.batchId,
    batchNumber: device.batch?.batchNumber ?? null,
    assignee: device.assignedTo?.name ?? null,
    canReview:
      write &&
      !!device.batch &&
      device.batch.status !== "CANCELLED" &&
      !/-R-[^-]+-/i.test(device.batch.batchNumber) &&
      (actor.roleCode === "ADMIN" || device.assignedToId === actor.id),
    result:
      inspection &&
      device.batch &&
      inspection.createdAt >= device.batch.createdAt &&
      (inspection.result === "FUNCTIONAL" ||
        inspection.result === "NON_FUNCTIONAL")
        ? inspection.result
        : null,
  };
}
export async function readQc(
  actor: Actor,
  query: string,
  page: number
): Promise<QcPage> {
  const where: Prisma.DeviceUnitWhereInput = {
    ...(actor.roleCode !== "ADMIN" ? { assignedToId: actor.id } : {}),
    batch: {
      status: { not: "CANCELLED" },
      NOT: { batchNumber: { contains: "-R-", mode: "insensitive" } },
    },
    ...(query
      ? {
          OR: ["imei", "serialNumber", "brand", "model"].map((key) => ({
            [key]: { contains: query, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const [devices, write] = await Promise.all([
    prisma.deviceUnit.findMany({
      where,
      select,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 21,
    }),
    can("qc.write"),
  ]);
  return {
    devices: devices.slice(0, 20).map((d) => qcDeviceDTO(d, actor, write)),
    page,
    hasMore: devices.length > 20,
  };
}
export async function readQcDetail(
  actor: Actor,
  id: string
): Promise<QcDetail | null> {
  // QC history has the same module-level read permission as the existing web.
  const [device, write] = await Promise.all([
    prisma.deviceUnit.findUnique({ where: { id }, select }),
    can("qc.write"),
  ]);
  if (!device) return null;
  const history = await getDeviceHistoryAction(id);
  if (!history.success || !history.data)
    throw new Error("Historial no disponible");
  return {
    device: qcDeviceDTO(device, actor, write),
    inspections: history.data.inspections.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      reviewedAt: i.reviewedAt?.toISOString() ?? null,
    })),
    photos: history.data.photos,
  };
}
