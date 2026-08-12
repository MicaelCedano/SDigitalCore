import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { QcModelImagesManager } from "@/modules/configuracion/components/QcModelImagesManager";

export const metadata: Metadata = {
  title: "Imágenes de QC | SDigitalCore",
  description: "Imágenes de referencia de los modelos para el Control de Calidad",
};

export default async function QcModelImagesPage() {
  await requirePermission("settings.read");
  try {
    const [models, savedImages] = await Promise.all([
      prisma.$queryRaw<{ brand: string; model: string; count: number }[]>`
        SELECT UPPER(brand) AS brand, UPPER(model) AS model, COUNT(*)::int AS count
        FROM device_unit
        GROUP BY UPPER(brand), UPPER(model)
        ORDER BY count DESC
      `,
      prisma.qcModelImage.findMany({ select: { brand: true, model: true, imageUrl: true } }),
    ]);

    const imageByKey = new Map(savedImages.map((img) => [`${img.brand}|${img.model}`, img.imageUrl]));

    const items = models.map((m) => ({
      brand: m.brand,
      model: m.model,
      deviceCount: m.count,
      imageUrl: imageByKey.get(`${m.brand}|${m.model}`) ?? null,
    }));

    return <QcModelImagesManager initialItems={items} databaseReady />;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return <QcModelImagesManager initialItems={[]} databaseReady={false} />;
    }
    throw error;
  }
}
