import type { Metadata } from "next";
import type { Prisma, QcInspectionResult } from "@prisma/client";
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
  const result = params.result === "FUNCTIONAL" || params.result === "NON_FUNCTIONAL" || params.result === "UNSPECIFIED"
    ? params.result as QcInspectionResult
    : undefined;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const today = santoDomingoDayRange();

  const where: Prisma.QcInspectionWhereInput = {
    status: "COMPLETED",
    reviewedAt: { not: null },
    ...(result ? { result } : {}),
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

  const [total, inspections, functional, nonFunctional, unspecified, reviewedToday] = await Promise.all([
    prisma.qcInspection.count({ where }),
    prisma.qcInspection.findMany({
      where,
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        result: true,
        grade: true,
        batteryHealth: true,
        reviewedAt: true,
        reviewerNameSnapshot: true,
        device: {
          select: { id: true, imei: true, serialNumber: true, brand: true, model: true, storageGb: true, color: true, status: true },
        },
      },
    }),
    prisma.qcInspection.count({ where: { status: "COMPLETED", result: "FUNCTIONAL" } }),
    prisma.qcInspection.count({ where: { status: "COMPLETED", result: "NON_FUNCTIONAL" } }),
    prisma.qcInspection.count({ where: { status: "COMPLETED", result: "UNSPECIFIED" } }),
    prisma.qcInspection.count({ where: { status: "COMPLETED", reviewedAt: { gte: today.start, lt: today.end } } }),
  ]);

  return (
    <ReviewedDevicesPage
      inspections={inspections}
      stats={{ total: functional + nonFunctional + unspecified, functional, nonFunctional, unspecified, reviewedToday }}
      filters={{ query, result: result ?? "ALL" }}
      pagination={{ page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }}
    />
  );
}
