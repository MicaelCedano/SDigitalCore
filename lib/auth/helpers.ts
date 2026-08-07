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

  // TODO (Fase 3): Consultar roles y permisos reales desde la base de datos
  // Por ahora el admin de prueba tiene todos los permisos
  const adminEmails = process.env.ADMIN_EMAILS?.split(",") ?? [];
  const email = session.user.email ?? "";
  if (adminEmails.includes(email)) return true;

  // El administrador local conserva acceso aunque cambie su correo desde Perfil.
  if (session.user.id === "dev-admin-001" && process.env.NEXTAUTH_URL?.includes("localhost")) {
    return true;
  }

  // El usuario demo definido en auth/config.ts debe poder probar las fases
  // locales sin depender de una fila de permisos que todavía no existe.
  if (process.env.NODE_ENV === "development" && email === "admin@sdigital.local") {
    return true;
  }

  console.warn(
    `[can] Verificación de permiso "${permission}" pendiente de implementar en Fase 3`
  );
  return false;
}
