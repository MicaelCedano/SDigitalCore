import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogEntry {
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      module: entry.module,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeData: entry.beforeData,
      afterData: entry.afterData,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}
