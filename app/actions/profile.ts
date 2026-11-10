"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { loadAvatarPresence } from "@/lib/auth/avatar-presence";
import { avatarVersion } from "@/lib/auth/avatar-url";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { fitAnimatedProfileImage } from "@/lib/profile-image";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

export async function getProfileAction() {
  try {
    const sessionUser = await requireUser();
    if (!sessionUser.id) return { success: false as const, error: "La sesión no tiene un usuario identificable." };
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, username: true, phone: true, roleCode: true, updatedAt: true },
    });
    if (!user) return { success: false as const, error: "La cuenta autenticada no existe en la base de datos." };
    const presence = await loadAvatarPresence([user.id]);
    return {
      success: true as const,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        roleCode: user.roleCode,
        hasImage: presence.get(user.id) === true,
        avatarVersion: avatarVersion(user.updatedAt),
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
    const nextImage = validated.avatarUrl === undefined
      ? undefined
      : (validated.avatarUrl ? await fitAnimatedProfileImage(validated.avatarUrl) : "") || null;

    const existingEmail = await prisma.user.findFirst({
      where: { email: validated.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (existingEmail) return { success: false, error: "Ese correo ya está registrado." };

    const existingUsername = await prisma.user.findFirst({
      where: { username: validated.username, NOT: { id: userId } },
      select: { id: true },
    });
    if (existingUsername) return { success: false, error: "Ese nombre de usuario ya está registrado." };

    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, username: true, phone: true },
    });
    if (!before) return { success: false, error: "La cuenta no existe en la base de datos." };
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: validated.name,
        email: validated.email.toLowerCase(),
        username: validated.username.toLowerCase(),
        phone: validated.phone || null,
        ...(nextImage !== undefined ? { image: nextImage } : {}),
      },
      select: { id: true, name: true, email: true, username: true, phone: true, roleCode: true, updatedAt: true },
    });
    const hasImage = nextImage !== undefined
      ? Boolean(nextImage)
      : (await loadAvatarPresence([userId])).get(userId) === true;
    await logAudit({
      userId,
      action: "profile.update",
      module: "perfil",
      entityType: "user",
      entityId: userId,
      beforeData: { name: before.name, email: before.email, username: before.username, phone: before.phone },
      afterData: {
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        avatarUpdated: nextImage !== undefined,
      },
    });

    revalidatePath("/perfil");
    revalidatePath("/", "layout");
    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        roleCode: user.roleCode,
        hasImage,
        avatarVersion: avatarVersion(user.updatedAt),
      },
      requiresRelogin: user.email !== sessionUser.email,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: error.issues[0]?.message ?? "Los datos del perfil no son válidos." };
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el perfil" };
  }
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }) {
  try {
    const sessionUser = await requireUser();
    if (!sessionUser.id) return { success: false as const, error: "La sesión no tiene un usuario identificable." };
    const validated = passwordChangeSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { passwordHash: true } });
    if (!user?.passwordHash || !(await verifyPassword(validated.currentPassword, user.passwordHash))) {
      return { success: false as const, error: "La contraseña actual no es correcta." };
    }
    await prisma.user.update({ where: { id: sessionUser.id }, data: { passwordHash: await hashPassword(validated.newPassword) } });
    await logAudit({ userId: sessionUser.id, action: "password.update", module: "perfil", entityType: "user", entityId: sessionUser.id });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo cambiar la contraseña." };
  }
}
