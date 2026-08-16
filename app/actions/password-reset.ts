"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const requestSchema = z.object({
  identifier: z.string().trim().min(1, "Escribe tu usuario o correo."),
});

const resetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(input: { identifier: string }) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const identifier = parsed.data.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { id: true, email: true, name: true, status: true },
  });

  // No revelar si el usuario existe.
  if (!user || user.status !== "ACTIVE") return { success: true as const };

  const rawToken = randomBytes(32).toString("hex");
  const token = hashToken(rawToken);
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
    prisma.verificationToken.create({ data: { identifier: user.email, token, expires } }),
    prisma.auditLog.create({
      data: { action: "password.reset.request", module: "auth", entityType: "user", entityId: user.id },
    }),
  ]);

  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  if (!baseUrl || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error("[password-reset] Falta NEXTAUTH_URL, RESEND_API_KEY o RESEND_FROM_EMAIL.");
    return { success: false as const, error: "La recuperación no está configurada todavía. Contacta al administrador." };
  }

  const resetUrl = `${baseUrl}/recuperar-password?token=${rawToken}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [user.email],
      subject: "Restablece tu contraseña de SDigitalCore",
      text: `Hola${user.name ? ` ${user.name}` : ""}.\n\nRestablece tu contraseña aquí: ${resetUrl}\n\nEste enlace vence en 30 minutos y solo puede usarse una vez.`,
      html: `<p>Hola${user.name ? ` ${user.name}` : ""}.</p><p>Haz clic para restablecer tu contraseña:</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p>Este enlace vence en 30 minutos y solo puede usarse una vez.</p>`,
    }),
  });

  if (!response.ok) {
    console.error("[password-reset] Resend rechazó el correo", await response.text());
    return { success: false as const, error: "No se pudo enviar el correo. Inténtalo de nuevo." };
  }

  return { success: true as const };
}

export async function resetPassword(input: { token: string; password: string; confirmPassword: string }) {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: { token: hashToken(parsed.data.token), expires: { gt: new Date() } },
  });
  if (!tokenRecord) return { success: false as const, error: "El enlace no es válido o ya venció." };

  const user = await prisma.user.findUnique({ where: { email: tokenRecord.identifier }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return { success: false as const, error: "El enlace no es válido o ya venció." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: tokenRecord.identifier, token: tokenRecord.token } } }),
    prisma.auditLog.create({ data: { action: "password.reset.complete", module: "auth", entityType: "user", entityId: user.id } }),
  ]);

  return { success: true as const };
}
