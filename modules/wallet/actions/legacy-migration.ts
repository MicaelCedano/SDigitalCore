"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getPersistedCurrentUser, requirePermission } from "@/lib/auth/helpers";
import { linkLegacyIdentity } from "@/lib/wallet/legacy-identity";

const linkSchema = z.object({
  legacyIdentityId: z.string().min(1),
  coreUserId: z.string().min(1),
});

async function requireMigrationAdmin() {
  const sessionUser = await requirePermission("settings.manage");
  const persisted = await getPersistedCurrentUser();
  if (!sessionUser.id || !persisted || persisted.status !== "ACTIVE" || persisted.roleCode !== "ADMIN") {
    throw new Error("Esta operación requiere un administrador activo.");
  }
  return sessionUser as typeof sessionUser & { id: string };
}

export async function linkLegacyIdentityAction(input: z.input<typeof linkSchema>) {
  try {
    const actor = await requireMigrationAdmin();
    const data = linkSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      const linked = await linkLegacyIdentity(tx, {
        ...data,
        actorId: actor.id,
        method: "admin_confirmed",
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "legacy_identity.link",
          module: "configuracion",
          entityType: "legacy_user_identity",
          entityId: linked.identity.id,
          afterData: {
            sourceSystem: linked.identity.sourceSystem,
            sourceUserId: linked.identity.sourceUserId,
            coreUserId: linked.user.id,
            walletAccessGranted: linked.walletAccessGranted,
          },
        },
      });
      return linked;
    });
    revalidatePath("/configuracion/migracion-usuarios");
    revalidatePath("/wallet");
    revalidatePath("/", "layout");
    return {
      success: true as const,
      message: result.walletAccessGranted
        ? `Identidad QC enlazada con ${result.user.name ?? result.user.email}; Wallet habilitada.`
        : `Identidad enlazada con ${result.user.name ?? result.user.email}; no se habilitó Wallet porque no pertenece a QC.`,
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo enlazar la identidad." };
  }
}

const excludeSchema = z.object({ legacyIdentityId: z.string().min(1), reason: z.string().trim().min(5).max(300) });

export async function excludeLegacyIdentityAction(input: z.input<typeof excludeSchema>) {
  try {
    const actor = await requireMigrationAdmin();
    const data = excludeSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const identity = await tx.legacyUserIdentity.findUnique({ where: { id: data.legacyIdentityId } });
      if (!identity) throw new Error("La identidad anterior no existe.");
      if (identity.matchStatus === "TRANSFERRED" || identity.coreUserId) {
        throw new Error("Una identidad enlazada o transferida no puede excluirse.");
      }
      await tx.legacyUserIdentity.update({
        where: { id: identity.id },
        data: { matchStatus: "EXCLUDED", matchMethod: "admin_excluded", linkedById: actor.id, linkedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "legacy_identity.exclude",
          module: "configuracion",
          entityType: "legacy_user_identity",
          entityId: identity.id,
          afterData: { reason: data.reason, sourceUserId: identity.sourceUserId },
        },
      });
    });
    revalidatePath("/configuracion/migracion-usuarios");
    return { success: true as const, message: "Identidad excluida con motivo auditado." };
  } catch (error) {
    const fallback = "No se pudo excluir la identidad.";
    return { success: false as const, error: error instanceof z.ZodError ? error.issues[0]?.message ?? fallback : error instanceof Error ? error.message : fallback };
  }
}
