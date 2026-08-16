import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { cache } from "react";
import { redirect } from "next/navigation";

/**
 * Obtiene la sesión actual. Retorna null si no hay sesión.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

/**
 * Exige sesión activa. Redirige a /login si no hay sesión.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export const getPersistedCurrentUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  return prisma.user.findFirst({
    where: user.id ? { id: user.id } : { email: user.email ?? "" },
    select: { id: true, roleCode: true, allowedModules: true, image: true, status: true },
  });
});

/**
 * Exige un permiso específico. Lanza error 403 si no lo tiene.
 * La comprobación se realiza contra el usuario persistido en PostgreSQL.
 */
export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (!user.id) throw new Error("La sesión no tiene un usuario persistido.");
  const hasPermission = await can(permission);
  if (!hasPermission) {
    throw new Error(
      `Acceso denegado: no tienes el permiso "${permission}". Usuario: ${user.email}`
    );
  }
  return user as typeof user & { id: string };
}

/**
 * Verifica si el usuario actual tiene un permiso. Retorna boolean.
 * Utiliza la consulta cacheada del usuario en memoria para máxima velocidad.
 */
export async function can(permission: string): Promise<boolean> {
  try {
    const persistedUser = await getPersistedCurrentUser();
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
      warranties: "garantias",
      qc: "qc",
      wallet: "wallet",
    };
    const moduleKey = moduleAliases[permissionModule] ?? permissionModule;
    return persistedUser.allowedModules.includes(moduleKey);
  } catch (error) {
    console.error(`[can] No se pudo verificar el permiso "${permission}"`, error);
    return false;
  }
}
