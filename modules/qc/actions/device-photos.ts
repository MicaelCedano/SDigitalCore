"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/storage";
import { normalizeQcPhoto } from '../lib/photo-input';
import { z } from 'zod';

const BUCKET = "defectos-equipos";
const DRIVE_PREFIX = "drive:";

function driveScriptUrl() {
  return process.env.QC_GOOGLE_APPS_SCRIPT_URL?.trim() || "";
}

function driveFileUrl(storagePath: string) {
  const fileId = storagePath.slice(DRIVE_PREFIX.length);
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

async function callDriveScript(payload: Record<string, unknown>) {
  const url = driveScriptUrl();
  if (!url) return null;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, token: process.env.QC_GOOGLE_APPS_SCRIPT_TOKEN }),
  });
  const data = (await response.json()) as { success?: boolean; error?: string; uploaded?: Array<{ id: string }> };
  if (!response.ok || !data.success) throw new Error(data.error || "Google Drive rechazó la operación.");
  return data;
}

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
  if (!persisted || persisted.status !== 'ACTIVE' || persisted.id !== actorId) return { error: 'La sesión ya no está activa.' };
  if (persisted.roleCode !== "ADMIN" && device.assignedToId !== actorId) {
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

    const received = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (received.length === 0) return { success: false, error: "No se recibieron fotos.", uploaded: 0 };
    if (received.length > 20 || received.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024)
      return { success: false, error: 'Adjunta hasta 20 fotos y 20 MB por envío.', uploaded: 0 };
    const command = formData.get('mobileCommandId');
    const commandId = command === null ? null : z.string().uuid().parse(command);
    if (commandId && received.length !== 1) return { success: false, error: 'Envía una foto por operación.', uploaded: 0 };

    const access = await assertDeviceAccess(deviceId, actor.id);
    if (access.error) return { success: false, error: access.error, errorCode: 'QC_FORBIDDEN', uploaded: 0 };

    const photoId = commandId ? `mobile-photo-${commandId}` : undefined;
    if (photoId) {
      const previous = await prisma.devicePhoto.findUnique({ where: { id: photoId } });
      if (previous) return previous.deviceId === deviceId && previous.createdById === actor.id
        ? { success: true, uploaded: 1, replayed: true }
        : { success: false, error: 'El envío pertenece a otra foto.', uploaded: 0 };
    }
    const files = await Promise.all(received.map(normalizeQcPhoto));
    const persistPhoto = async (storagePath: string) => {
      if (!photoId) { await prisma.devicePhoto.create({ data: { deviceId, storagePath, createdById: actor.id } }); return; }
      try {
        await prisma.$transaction(async tx => {
          await tx.devicePhoto.create({ data: { id: photoId, deviceId, storagePath, createdById: actor.id } });
          await tx.auditLog.create({ data: { userId: actor.id, action: 'device_photo.upload', module: 'qc', entityType: 'device_unit', entityId: deviceId, afterData: { uploaded: 1, commandId } } });
        });
      } catch (error) {
        // Clean up a failed/competing upload; a retry reads the durable photo ID.
        const existing = await prisma.devicePhoto.findUnique({ where: { id: photoId } });
        if (!existing || existing.storagePath !== storagePath) {
          try {
            if (storagePath.startsWith(DRIVE_PREFIX)) await callDriveScript({ action: 'delete', fileId: storagePath.slice(DRIVE_PREFIX.length) });
            else await createServiceClient().storage.from(BUCKET).remove([storagePath]);
          } catch { console.error('[qc/photo] No se pudo limpiar una carga sin registrar.'); }
        }
        if (!existing || existing.deviceId !== deviceId || existing.createdById !== actor.id) throw error;
      }
    };

    const device = access.device;
    const imei = String(formData.get("imei") || device?.id || deviceId);
    const driveFiles = driveScriptUrl()
      ? await callDriveScript({
          action: "upload",
          deviceId,
          imei,
          files: await Promise.all(
            files.map(async (file) => ({
              base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
              mimeType: file.type || "image/webp",
              extension: file.type.includes("png") ? "png" : "webp",
            }))
          ),
        })
      : null;

    if (driveFiles) {
      for (const file of driveFiles.uploaded ?? []) {
        await persistPhoto(`${DRIVE_PREFIX}${file.id}`);
      }
      const uploaded = driveFiles.uploaded?.length ?? 0;
      if (!photoId) await logAudit({ userId: actor.id, action: "device_photo.upload", module: "qc", entityType: "device_unit", entityId: deviceId, afterData: { uploaded, provider: "google_drive" } });
      return uploaded > 0
        ? { success: true, uploaded }
        : { success: false, error: "Google Drive no devolvió archivos subidos.", uploaded: 0 };
    }

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
      await persistPhoto(path);
      uploaded++;
    }

    if (!photoId) await logAudit({
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
          if (photo.storagePath.startsWith(DRIVE_PREFIX)) {
            return { ...photo, url: driveFileUrl(photo.storagePath) };
          }
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
    if (photo.storagePath.startsWith(DRIVE_PREFIX)) {
      await callDriveScript({ action: "delete", fileId: photo.storagePath.slice(DRIVE_PREFIX.length) });
    } else {
      await supabase.storage.from(BUCKET).remove([photo.storagePath]);
    }
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
