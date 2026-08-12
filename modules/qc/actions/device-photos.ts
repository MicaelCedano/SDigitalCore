"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/storage";

const BUCKET = "defectos-equipos";

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
    if (error) console.error("Error creando bucket:", error);
  }
}

async function assertDeviceAccess(deviceId: string, actorId: string) {
  const device = await prisma.deviceUnit.findUnique({
    where: { id: deviceId },
    select: { id: true, assignedToId: true },
  });
  if (!device) return { error: "El equipo no existe." };
  const persisted = await getPersistedCurrentUser();
  if (persisted && persisted.roleCode !== "ADMIN" && device.assignedToId !== actorId) {
    return { error: "Este IMEI no está asignado a tu usuario." };
  }
  return { device };
}

/**
 * Sube fotos de defectos de un equipo (misma regla de acceso que reviewDeviceAction:
 * el QC solo puede subir fotos de los equipos que tiene asignados; el admin de todos).
 * Las fotos llegan ya comprimidas en WebP desde el cliente.
 */
export async function uploadDevicePhotosAction(formData: FormData) {
  try {
    const actor = await requirePermission("qc.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable.", uploaded: 0 };
    }

    const deviceId = String(formData.get("deviceId") || "");
    if (!deviceId) return { success: false, error: "Falta el identificador del equipo.", uploaded: 0 };

    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { success: false, error: "No se recibieron fotos.", uploaded: 0 };

    const access = await assertDeviceAccess(deviceId, actor.id);
    if (access.error) return { success: false, error: access.error, uploaded: 0 };

    const supabase = createServiceClient();
    await ensureBucket(supabase);

    let uploaded = 0;
    for (const file of files) {
      const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
      const path = `${deviceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        console.error("Error subiendo foto al storage:", error);
        continue;
      }
      await prisma.devicePhoto.create({
        data: { deviceId, storagePath: path, createdById: actor.id },
      });
      uploaded++;
    }

    await logAudit({
      userId: actor.id,
      action: "device_photo.upload",
      module: "qc",
      entityType: "device_unit",
      entityId: deviceId,
      afterData: { uploaded },
    });

    if (uploaded === 0) return { success: false, error: "No se pudo subir ninguna foto.", uploaded: 0 };
    return { success: true, uploaded };
  } catch (error: any) {
    console.error("Error al subir fotos:", error);
    return { success: false, error: error.message || "Error al subir las fotos", uploaded: 0 };
  }
}

/**
 * Fotos de un equipo con URLs firmadas (válidas 1 hora).
 */
export async function getDevicePhotosAction(deviceId: string) {
  try {
    await requirePermission("qc.read");

    const photos = await prisma.devicePhoto.findMany({
      where: { deviceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, storagePath: true, createdAt: true, createdById: true },
    });

    if (photos.length === 0) return { success: true, data: [] };

    const supabase = createServiceClient();
    const withUrls = (
      await Promise.all(
        photos.map(async (photo) => {
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storagePath, 3600);
          return data?.signedUrl ? { ...photo, url: data.signedUrl } : null;
        })
      )
    ).filter(Boolean);

    return { success: true, data: withUrls };
  } catch (error: any) {
    console.error("Error al obtener fotos:", error);
    return { success: false, error: error.message || "Error al obtener las fotos", data: [] };
  }
}

/**
 * Elimina una foto (solo su creador o el admin).
 */
export async function deleteDevicePhotoAction(photoId: string) {
  try {
    const actor = await requirePermission("qc.write");
    if (!actor.id) {
      return { success: false, error: "La sesión no tiene un usuario identificable." };
    }

    const photo = await prisma.devicePhoto.findUnique({ where: { id: photoId } });
    if (!photo) return { success: false, error: "La foto no existe." };

    const persisted = await getPersistedCurrentUser();
    if (persisted && persisted.roleCode !== "ADMIN" && photo.createdById !== actor.id) {
      return { success: false, error: "Solo puedes eliminar tus propias fotos." };
    }

    const supabase = createServiceClient();
    await supabase.storage.from(BUCKET).remove([photo.storagePath]);
    await prisma.devicePhoto.delete({ where: { id: photoId } });

    await logAudit({
      userId: actor.id,
      action: "device_photo.delete",
      module: "qc",
      entityType: "device_photo",
      entityId: photoId,
      beforeData: { deviceId: photo.deviceId, storagePath: photo.storagePath },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar foto:", error);
    return { success: false, error: error.message || "Error al eliminar la foto" };
  }
}
