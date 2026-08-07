"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export async function getProfileAction() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, username: true, image: true },
    });

    return {
      success: true as const,
      data: user ?? {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        username: sessionUser.name?.toLowerCase().replace(/\s+/g, "") ?? "admin",
        image: sessionUser.image ?? null,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo cargar el perfil" };
  }
}

export async function updateProfileAction(input: ProfileInput) {
  try {
    const sessionUser = await requireUser();
    const validated = profileSchema.parse(input);
    const userId = sessionUser.id;
    if (!userId) return { success: false, error: "La sesión no tiene un usuario identificable." };

    const existingEmail = await prisma.user.findFirst({
      where: { email: validated.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (existingEmail) return { success: false, error: "Ese correo ya está registrado." };

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        name: validated.name,
        email: validated.email,
        username: validated.username,
      },
      create: {
        id: userId,
        name: validated.name,
        email: validated.email,
        username: validated.username,
        status: "ACTIVE",
      },
      select: { id: true, name: true, email: true, username: true },
    });

    revalidatePath("/perfil");
    revalidatePath("/precios");
    return { success: true, data: user, requiresRelogin: user.email !== sessionUser.email };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el perfil" };
  }
}
