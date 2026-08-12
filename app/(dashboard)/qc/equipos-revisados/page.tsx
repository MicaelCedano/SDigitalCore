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

  const [total, inspections, resultStats, reviewedToday] = await Promise.all([
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
        functionalityNotes: true,
        physicalNotes: true,
        reviewedAt: true,
        createdAt: true,
        reviewerNameSnapshot: true,
        reviewerId: true,
        reviewer: { select: { id: true, name: true, username: true } },
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
    }),
    // Un solo groupBy para las tres estadísticas de resultado (antes eran 3 counts).
    prisma.qcInspection.groupBy({
      by: ["result"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.qcInspection.count({ where: { status: "COMPLETED", reviewedAt: { gte: today.start, lt: today.end } } }),
  ]);

  const byResult = new Map(resultStats.map((r) => [r.result, r._count._all]));
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
