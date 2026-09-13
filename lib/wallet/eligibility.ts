import type { Prisma } from "@prisma/client";

/**
 * Usuarios que el panel administrativo presenta como integrantes pagables.
 *
 * Algunos usuarios migrados conservan un roleCode distinto de QC/TECNICO,
 * pero tienen acceso explícito al módulo Wallet. Se excluye ADMIN siempre.
 */
export const WALLET_ELIGIBLE_USER_FILTER = {
  roleCode: { not: "ADMIN" },
  OR: [
    { roleCode: { in: ["QC", "TECNICO"] } },
    { allowedModules: { has: "wallet" } },
  ],
} satisfies Prisma.UserWhereInput;
