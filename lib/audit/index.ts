import { prisma } from "@/lib/db";

export interface AuditLogEntry {
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra una acción en el log de auditoría.
 * En Fase 1 solo imprime en consola (la tabla audit_log se crea en Fase 2).
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  // TODO (Fase 2): insertar en tabla audit_log real
  if (process.env.NODE_ENV === "development") {
    console.log("[audit]", JSON.stringify(entry, null, 2));
    return;
  }

  try {
    // Placeholder — se activará cuando exista la tabla audit_log en Fase 2
    // await prisma.auditLog.create({ data: { ...entry } });
    void prisma; // evita error de import no usado
  } catch (error) {
    // No lanzar errores por auditoría — nunca interrumpir el flujo principal
    console.error("[audit] Error al registrar:", error);
  }
}
