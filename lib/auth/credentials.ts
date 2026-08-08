/**
 * Módulo separado para verificar credenciales en DB.
 * Se importa dinámicamente desde auth/config.ts para que
 * Prisma NO llegue al Edge runtime de Next.js.
 */
export async function verifyUserCredentials(
  identifier: string,
  _password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const { prisma } = await import("@/lib/db/prisma");

  const query = identifier.trim();

  // Buscar por username, email o name
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: query, mode: "insensitive" } },
        { email: { equals: query, mode: "insensitive" } },
        { name: { equals: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      status: true,
      passwordHash: true,
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  // TODO (Fase 3): comparar con bcrypt
  // const valid = await bcrypt.compare(_password, user.passwordHash ?? "");
  // if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name ?? user.username };
}
