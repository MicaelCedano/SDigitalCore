import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { ReviewedDevicesPage } from "@/modules/qc/components/ReviewedDevicesPage";

export const metadata: Metadata = { title: "Equipos revisados | Control de Calidad" };

const PAGE_SIZE = 20;

function santoDomingoDayRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const start = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 4));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export default async function EquiposRevisadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; result?: string; page?: string }>;
}) {
  await requirePermission("qc.read");
  // En SDigitalSystem esto es inventario: lo maneja el admin, no el QC.
  const persisted = await getPersistedCurrentUser();
  if (persisted?.roleCode !== "ADMIN") {
    redirect("/qc");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const result: "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" | undefined =
    params.result === "FUNCTIONAL" || params.result === "NON_FUNCTIONAL" || params.result === "UNSPECIFIED"
      ? params.result
      : undefined;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const today = santoDomingoDayRange();

  const where: Prisma.QcInspectionWhereInput = {
    status: "COMPLETED",
    reviewedAt: { not: null },
    ...(query
      ? {
          OR: [
            { device: { imei: { contains: query, mode: "insensitive" } } },
            { device: { serialNumber: { contains: query, mode: "insensitive" } } },
            { device: { brand: { contains: query, mode: "insensitive" } } },
            { device: { model: { contains: query, mode: "insensitive" } } },
            { reviewerNameSnapshot: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Hay varias inspecciones históricas por equipo cuando se corrige o se
  // reingresa. El listado principal representa equipos, por lo que primero
  // conservamos solo la inspección más reciente de cada DeviceUnit.
  const allInspections = await prisma.qcInspection.findMany({
    where,
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      deviceId: true,
      result: true,
      grade: true,
      batteryHealth: true,
      functionalityNotes: true,
      physicalNotes: true,
      reviewedAt: true,
      createdAt: true,
      reviewerNameSnapshot: true,
      reviewerId: true,
      reviewer: { select: { id: true, name: true, username: true, roleCode: true } },
      device: {
        select: {
          id: true,
          imei: true,
          serialNumber: true,
          brand: true,
          model: true,
          storageGb: true,
          color: true,
          status: true,
          batch: { select: { batchNumber: true, supplierName: true, status: true } },
        },
      },
    },
  });

  const latestByDevice = new Map<string, (typeof allInspections)[number]>();
  for (const inspection of allInspections) {
    // La verificación física del administrador puede crear una inspección
    // posterior, pero no debe reemplazar al último revisor de QC en esta vista.
    const snapshotRole = inspection.reviewerNameSnapshot.trim().toLocaleLowerCase("es");
    const isLegacyAdministrativeReview =
      !inspection.reviewerId && ["admin", "administrador", "administración"].includes(snapshotRole);
    if (inspection.reviewer?.roleCode === "ADMIN" || isLegacyAdministrativeReview) continue;
    if (!latestByDevice.has(inspection.deviceId)) latestByDevice.set(inspection.deviceId, inspection);
  }

  const latestInspections = Array.from(latestByDevice.values());
  const filteredInspections = result ? latestInspections.filter((inspection) => inspection.result === result) : latestInspections;
  const total = filteredInspections.length;
  const inspections = filteredInspections.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resultStats = new Map<string | null, number>();
  for (const inspection of latestInspections) {
    resultStats.set(inspection.result, (resultStats.get(inspection.result) ?? 0) + 1);
  }
  const todayStart = today.start.getTime();
  const todayEnd = today.end.getTime();
  const reviewedToday = latestInspections.filter((inspection) => {
    const reviewedAt = inspection.reviewedAt?.getTime();
    return reviewedAt !== undefined && reviewedAt >= todayStart && reviewedAt < todayEnd;
  }).length;

  const byResult = resultStats;
  const functional = byResult.get("FUNCTIONAL") ?? 0;
  const nonFunctional = byResult.get("NON_FUNCTIONAL") ?? 0;
  const unspecified = byResult.get("UNSPECIFIED") ?? 0;

  return (
    <ReviewedDevicesPage
      inspections={inspections}
      stats={{ total: functional + nonFunctional + unspecified, functional, nonFunctional, unspecified, reviewedToday }}
      filters={{ query, result: result ?? "ALL" }}
      pagination={{ page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }}
    />
  );
}
