/** Versión cacheable del avatar. Cambia cuando el usuario se actualiza (la foto incluida). */
export function avatarVersion(updatedAt: Date | string | number | null | undefined): string {
  if (updatedAt == null || updatedAt === "") return "0";
  if (typeof updatedAt === "number") return Number.isFinite(updatedAt) ? String(Math.trunc(updatedAt)) : "0";
  if (typeof updatedAt === "string" && /^\d+$/.test(updatedAt)) return updatedAt;
  const time = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  return Number.isFinite(time) ? String(time) : "0";
}

/** URL del avatar. `v` invalida la caché del navegador sin volver a incrustar la imagen. */
export function publicAvatarUrl(userId: string, updatedAt: Date | string | number | null | undefined): string {
  return `/api/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarVersion(updatedAt))}`;
}

export function publicAvatarSrc(
  userId: string,
  updatedAt: Date | string | number | null | undefined,
  hasImage: boolean,
): string | null {
  if (!hasImage) return null;
  return publicAvatarUrl(userId, updatedAt);
}
