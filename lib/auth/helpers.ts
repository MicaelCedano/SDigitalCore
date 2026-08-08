import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

/**
 * Obtiene la sesión actual. Retorna null si no hay sesión.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Exige sesión activa. Redirige a /login si no hay sesión.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Exige un permiso específico. Lanza error 403 si no lo tiene.
 * La comprobación se realiza contra el usuario persistido en PostgreSQL.
 */
export async function requirePermission(permission: string) {
  const user = await requireUser();
  const hasPermission = await can(permission);
  if (!hasPermission) {
    throw new Error(
      `Acceso denegado: no tienes el permiso "${permission}". Usuario: ${user.email}`
    );
  }
  return user;
}

/**
 * Verifica si el usuario actual tiene un permiso. Retorna boolean.
 * Comprueba el permiso contra el rol y los módulos persistidos del usuario.
 */
export async function can(permission: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const persistedUser = await prisma.user.findFirst({
      where: session.user.id
        ? { id: session.user.id }
        : { email: { equals: session.user.email ?? "", mode: "insensitive" } },
      select: { roleCode: true, allowedModules: true, status: true },
    });
    if (!persistedUser || persistedUser.status !== "ACTIVE") return false;
    if (persistedUser.roleCode === "ADMIN") return true;

    const permissionModule = permission.split(".")[0];
    const moduleAliases: Record<string, string> = {
      inventory: "inventario",
      warehouse: "almacen",
      sales: "ventas",
      repair: "taller",
      customers: "clientes",
      suppliers: "proveedores",
      prices: "precios",
      invoices: "facturas",
      reports: "reportes",
      settings: "configuracion",
    };
    const moduleKey = moduleAliases[permissionModule] ?? permissionModule;
    return persistedUser.allowedModules.includes(moduleKey);
  } catch (error) {
    console.error(`[can] No se pudo verificar el permiso "${permission}"`, error);
    return false;
  }
}
