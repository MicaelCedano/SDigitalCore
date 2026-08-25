"use client";

type CachedPhotos = {
  savedAt: number;
  photos: Array<{ id: string; url: string }>;
};

const CACHE_TTL_MS = 45 * 60 * 1000;
const prefix = "sdigitalcore.qc.device-photos.";

function key(deviceId: string) {
  return `${prefix}${deviceId}`;
}

export function getCachedDevicePhotos(deviceId: string) {
  try {
    const raw = window.sessionStorage.getItem(key(deviceId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedPhotos;
    if (!cached.savedAt || Date.now() - cached.savedAt > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key(deviceId));
      return null;
    }
    return cached.photos;
  } catch {
    return null;
  }
}

export function cacheDevicePhotos(deviceId: string, photos: Array<{ id: string; url: string }>) {
  try {
    const value: CachedPhotos = { savedAt: Date.now(), photos };
    window.sessionStorage.setItem(key(deviceId), JSON.stringify(value));
  } catch {
    // sessionStorage puede estar deshabilitado o lleno; no bloquear el flujo.
  }
}

export function clearCachedDevicePhotos(deviceId: string) {
  try {
    window.sessionStorage.removeItem(key(deviceId));
  } catch {
    // Sin caché disponible, la siguiente apertura volverá a consultar el servidor.
  }
}
