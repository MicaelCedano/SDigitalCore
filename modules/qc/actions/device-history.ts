"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { createServiceClient } from "@/lib/storage";

const BUCKET = "defectos-equipos";
const DRIVE_PREFIX = "drive:";

/**
 * Historial completo de un equipo: todas sus inspecciones + fotos de defectos
 * (con URLs firmadas). Se usa en el detalle de Equipos revisados.
 */
export async function getDeviceHistoryAction(deviceId: string) {
  try {
    await requirePermission("qc.read");

    const [inspections, photos] = await Promise.all([
      prisma.qcInspection.findMany({
        where: { deviceId },
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          result: true,
          grade: true,
          batteryHealth: true,
          functionalityNotes: true,
          physicalNotes: true,
          reviewerNameSnapshot: true,
          reviewedAt: true,
          createdAt: true,
          status: true,
        },
      }),
      prisma.devicePhoto.findMany({
        where: { deviceId },
        orderBy: { createdAt: "asc" },
        select: { id: true, storagePath: true, createdAt: true },
      }),
    ]);

    let photosWithUrl: { id: string; url: string }[] = [];
    if (photos.length > 0) {
      const supabase = createServiceClient();
      photosWithUrl = (
        await Promise.all(
          photos.map(async (photo) => {
            if (photo.storagePath.startsWith(DRIVE_PREFIX)) {
              const fileId = photo.storagePath.slice(DRIVE_PREFIX.length);
              return {
                id: photo.id,
                url: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`,
              };
            }
            const { data } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storagePath, 3600);
            return data?.signedUrl ? { id: photo.id, url: data.signedUrl } : null;
          })
        )
      ).filter(Boolean) as { id: string; url: string }[];
    }

    return { success: true, data: { inspections, photos: photosWithUrl } };
  } catch (error: any) {
    console.error("Error al obtener historial del equipo:", error);
    return { success: false, error: error.message || "Error al obtener el historial", data: null };
  }
}
