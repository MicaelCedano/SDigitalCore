"use server";

import { z } from "zod";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ok = <T>(data: T): Result<T> => ({ success: true, data });
const fail = (error: unknown, fallback: string): Result<never> => {
  console.error("[wallet] Error en cuentas", error);
  const msg = error instanceof Error ? error.message : fallback;
  return { success: false, error: msg };
};

const createAccountSchema = z.object({
  name: z.string().trim().min(2, "El nombre de la cuenta debe tener al menos 2 caracteres").max(80, "Nombre demasiado largo"),
  savingsGoal: z.number().finite().positive("La meta de ahorro debe ser un monto positivo").nullable().optional(),
  color: z.string().max(40).optional(),
});

export async function createSavingsAccountAction(input: unknown): Promise<Result<{ id: string; name: string }>> {
  try {
    const actor = await requirePermission("wallet.write");
    const persisted = await getPersistedCurrentUser();
    if (!persisted) return { success: false, error: "Sesión no persistida." };

    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { name, savingsGoal, color } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { userId: actor.id },
        include: { accounts: true },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: actor.id,
            balance: 0,
            accounts: {
              create: {
                name: "Principal",
                kind: "PRIMARY",
                balance: 0,
              },
            },
          },
          include: { accounts: true },
        });
      }

      // Validar que no tenga otra cuenta con el mismo nombre
      const exists = wallet.accounts.some(
        (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (exists) {
        throw new Error(`Ya tienes una cuenta llamada "${name}". Elige otro nombre.`);
      }

      const account = await tx.walletAccount.create({
        data: {
          walletId: wallet.id,
          name,
          kind: "SAVINGS",
          balance: 0,
          savingsGoal: savingsGoal ?? null,
          color: color ?? null,
        },
      });

      return account;
    });

    await logAudit({
      userId: actor.id,
      action: "wallet.account.create",
      module: "wallet",
      entityType: "WalletAccount",
      entityId: result.id,
      afterData: { name: result.name, kind: "SAVINGS", savingsGoal },
    });

    revalidatePath("/wallet");
    return ok({ id: result.id, name: result.name });
  } catch (error) {
    return fail(error, "No se pudo crear la cuenta de ahorro.");
  }
}
