import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function isTrue(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

/**
 * Indica qué usuarios tienen foto sin transferir el base64.
 * `length(image)` se calcula en Postgres; por el cable solo viaja un booleano.
 */
export async function loadAvatarPresence(ids: string[]): Promise<Map<string, boolean>> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  const presence = new Map<string, boolean>();
  if (unique.length === 0) return presence;

  const rows = await prisma.$queryRaw<Array<{ id: string; hasImage?: unknown; hasimage?: unknown }>>(
    Prisma.sql`
      SELECT id,
             (CASE WHEN image IS NULL THEN false WHEN length(image) > 0 THEN true ELSE false END) AS "hasImage"
      FROM "user"
      WHERE id IN (${Prisma.join(unique)})
    `,
  );

  for (const row of rows) {
    presence.set(row.id, isTrue(row.hasImage ?? row.hasimage));
  }
  return presence;
}
