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
 * En Fase 3 se conectará a la tabla de permisos real.
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
 * Placeholder — se implementa completamente en Fase 3.
 */
export async function can(permission: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  // El administrador debe conservar acceso total en local y producción.
  // ADMIN_EMAILS permite agregar otros administradores sin modificar el código.
  const configuredAdminEmails = process.env.ADMIN_EMAILS?.split(",") ?? [];
  const adminEmails = new Set(
    [
      "admin@sdigital.local",
      "micaelcedano.ai@gmail.com",
      ...configuredAdminEmails,
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const email = (session.user.email ?? "").trim().toLowerCase();
  if (adminEmails.has(email)) return true;

  // El administrador local conserva acceso aunque cambie su correo desde Perfil.
  if (session.user.id === "dev-admin-001") {
    return true;
  }

  console.warn(
    `[can] Verificación de permiso "${permission}" pendiente de implementar en Fase 3`
  );
  return false;
}
