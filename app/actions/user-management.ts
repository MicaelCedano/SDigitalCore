"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getPersistedCurrentUser, requirePermission } from "@/lib/auth/helpers";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import { linkLegacyIdentity } from "@/lib/wallet/legacy-identity";
import { accessRequestSchema, type AccessRequestInput } from "@/lib/validation/access-request";
import {
  DEFAULT_ROLE_MODULES,
  SYSTEM_MODULES,
  SYSTEM_ROLES,
  type AccessRequest,
  type SystemUser,
} from "@/lib/auth/roles-permissions";

const validRoles = new Set(SYSTEM_ROLES.map(({ code }) => code));
const validModules = new Set(SYSTEM_MODULES.map(({ key }) => key));

const userSchema = z.object({
  name: z.string().trim().min(2, "El nombre completo es requerido"),
  username: z.string().trim().min(3, "El usuario debe tener al menos 3 caracteres").regex(/^[a-zA-Z0-9_.-]+$/, "Usuario inválido"),
  email: z.string().trim().email("Email inválido"),
  phone: z.string().trim().min(7, "El teléfono es requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  roleCode: z.string().refine((value) => validRoles.has(value), "Rol inválido"),
  allowedModules: z.array(z.string()).refine((values) => values.every((value) => validModules.has(value)), "Módulo inválido"),
});

function serializeUser(user: {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  phone: string | null;
  image: string | null;
  roleCode: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  allowedModules: string[];
  createdAt: Date;
}): SystemUser {
  return {
    id: user.id,
    name: user.name ?? user.username ?? user.email,
    username: user.username ?? user.email.split("@")[0],
    email: user.email,
    phone: user.phone ?? "",
    avatarUrl: user.image ?? "",
    roleCode: user.roleCode,
    status: user.status === "ACTIVE" ? "ACTIVE" : "BLOCKED",
    allowedModules: user.roleCode === "ADMIN" ? [...DEFAULT_ROLE_MODULES.ADMIN] : user.allowedModules,
    createdAt: user.createdAt.toISOString(),
  };
}

function serializeRequest(request: {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  assignedRole: string | null;
  customModules: string[];
  createdAt: Date;
}): AccessRequest {
  return {
    id: request.id,
    name: request.name,
    username: request.username,
    email: request.email,
    phone: request.phone,
    status: request.status,
    assignedRole: request.assignedRole ?? undefined,
    customModules: request.customModules,
    createdAt: request.createdAt.toISOString(),
  };
}

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Error && error.message.includes("Unique constraint")) return "Ese usuario o correo ya está registrado.";
  return error instanceof Error ? error.message : fallback;
}

async function requireUserAdmin() {
  const user = await requirePermission("settings.manage");
  const persistedUser = await getPersistedCurrentUser();
  if (!persistedUser || persistedUser.status !== "ACTIVE" || persistedUser.roleCode !== "ADMIN") {
    throw new Error("Acceso denegado: esta operación requiere el rol ADMIN.");
  }
  if (!user.id) throw new Error("La sesión no tiene un usuario identificable.");
  return { ...user, id: user.id };
}

export async function getUserManagementDataAction() {
  try {
    await requireUserAdmin();
    const [users, requests] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.accessRequest.findMany({ orderBy: { createdAt: "desc" } }),
    ]);
    let identities: Awaited<ReturnType<typeof prisma.legacyUserIdentity.findMany>> = [];
    try {
      identities = await prisma.legacyUserIdentity.findMany({
        where: { matchStatus: { in: ["UNMATCHED", "SUGGESTED", "CONFLICT"] }, coreUserId: null },
      });
    } catch (error) {
      if (!(error instanceof Error && /legacy_user_identity|does not exist|P2021/i.test(error.message))) throw error;
    }
    const serializedRequests = requests.map((request) => {
      const email = request.email.trim().toLocaleLowerCase("es");
      const username = request.username.trim().toLocaleLowerCase("es");
      const emailMatches = identities.filter((identity) => identity.emailSnapshot?.trim().toLocaleLowerCase("es") === email);
      const usernameMatches = identities.filter((identity) => identity.usernameSnapshot.trim().toLocaleLowerCase("es") === username);
      const candidate = emailMatches.length === 1 ? emailMatches[0] : usernameMatches.length === 1 ? usernameMatches[0] : null;
      const matchMethod = emailMatches.length === 1 ? "exact_email" as const : "exact_username" as const;
      return {
        ...serializeRequest(request),
        legacyCandidate: candidate ? {
          id: candidate.id,
          username: candidate.usernameSnapshot,
          name: candidate.nameSnapshot ?? undefined,
          email: candidate.emailSnapshot ?? undefined,
          balance: candidate.sourceWalletBalance.toFixed(2),
          transactionCount: candidate.sourceTransactionCount,
          matchMethod,
          walletEligible: ["qc", "control_calidad"].includes(candidate.roleSnapshot?.trim().toLocaleLowerCase("es").replaceAll("-", "_").replaceAll(" ", "_") ?? ""),
        } : undefined,
      };
    });
    return { success: true as const, data: { users: users.map(serializeUser), requests: serializedRequests } };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudieron cargar los usuarios."), data: { users: [], requests: [] } };
  }
}

export async function submitAccessRequestAction(input: AccessRequestInput) {
  try {
    const validated = accessRequestSchema.parse(input);
    const username = validated.username.toLowerCase();
    const email = validated.email.toLowerCase();
    const existingUser = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true } });
    if (existingUser) return { success: false as const, error: "Ese usuario o correo ya pertenece a una cuenta." };

    const existingRequest = await prisma.accessRequest.findFirst({ where: { OR: [{ username }, { email }] } });
    const passwordHash = await hashPassword(validated.password);
    if (existingRequest) {
      if (existingRequest.username !== username || existingRequest.email !== email) {
        return { success: false as const, error: "El usuario o correo está usado por otra solicitud." };
      }
      await prisma.accessRequest.update({
        where: { id: existingRequest.id },
        data: { name: validated.name, phone: validated.phone, passwordHash, status: "PENDING", assignedRole: null, customModules: [] },
      });
    } else {
      await prisma.accessRequest.create({ data: { name: validated.name, username, email, phone: validated.phone, passwordHash } });
    }
    revalidatePath("/configuracion");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo enviar la solicitud.") };
  }
}

export async function createDirectUserAction(input: z.input<typeof userSchema>) {
  try {
    const actor = await requireUserAdmin();
    const data = userSchema.parse(input);
    const created = await prisma.user.create({
      data: {
        name: data.name,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        roleCode: data.roleCode,
        allowedModules: data.allowedModules,
        status: "ACTIVE",
      },
    });
    await logAudit({ userId: actor.id, action: "user.create", module: "configuracion", entityType: "user", entityId: created.id, afterData: { roleCode: created.roleCode } });
    revalidatePath("/configuracion");
    return { success: true as const, data: serializeUser(created) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo crear el usuario.") };
  }
}

export async function approveAccessRequestAction(requestId: string, roleCode: string, allowedModules: string[], legacyIdentityId?: string) {
  try {
    const actor = await requireUserAdmin();
    if (!validRoles.has(roleCode) || !allowedModules.every((value) => validModules.has(value))) throw new Error("Rol o módulos inválidos.");
    const approval = await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.findUnique({ where: { id: requestId } });
      if (!request || request.status !== "PENDING") throw new Error("La solicitud ya fue procesada o no existe.");
      const user = await tx.user.create({
        data: {
          name: request.name,
          username: request.username,
          email: request.email,
          phone: request.phone,
          passwordHash: request.passwordHash,
          roleCode,
          allowedModules,
          status: "ACTIVE",
        },
      });
      await tx.accessRequest.update({ where: { id: requestId }, data: { status: "APPROVED", assignedRole: roleCode, customModules: allowedModules } });
      const linked = legacyIdentityId
        ? await linkLegacyIdentity(tx, { legacyIdentityId: z.string().min(1).parse(legacyIdentityId), coreUserId: user.id, actorId: actor.id, method: "admin_confirmed_on_registration" })
        : null;
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "access_request.approve",
          module: "configuracion",
          entityType: "access_request",
          entityId: requestId,
          afterData: {
            createdUserId: user.id,
            roleCode,
            ...(linked ? { linkedLegacyIdentityId: linked.identity.id } : {}),
            ...(linked ? { walletAccessGranted: linked.walletAccessGranted } : {}),
          },
        },
      });
      return { user, linkedIdentityId: linked?.identity.id ?? null };
    });
    revalidatePath("/configuracion");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true as const, data: serializeUser(approval.user) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo aprobar la solicitud.") };
  }
}

export async function rejectAccessRequestAction(requestId: string) {
  try {
    const actor = await requireUserAdmin();
    const changed = await prisma.accessRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "REJECTED" } });
    if (changed.count !== 1) throw new Error("La solicitud ya fue procesada o no existe.");
    const updated = await prisma.accessRequest.findUniqueOrThrow({ where: { id: requestId } });
    await logAudit({ userId: actor.id, action: "access_request.reject", module: "configuracion", entityType: "access_request", entityId: requestId });
    revalidatePath("/configuracion");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true as const, data: serializeRequest(updated) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo rechazar la solicitud.") };
  }
}

export async function updateUserRoleAction(userId: string, roleCode: string) {
  try {
    const actor = await requireUserAdmin();
    if (!validRoles.has(roleCode)) throw new Error("Rol inválido.");
    if (userId === actor.id && roleCode !== "ADMIN") {
      return { success: false as const, error: "No puedes quitarte tu propio rol de administrador." };
    }
    const updated = await prisma.user.update({ where: { id: userId }, data: { roleCode, allowedModules: DEFAULT_ROLE_MODULES[roleCode] ?? [] } });
    await logAudit({ userId: actor.id, action: "user.role.update", module: "configuracion", entityType: "user", entityId: userId, afterData: { roleCode } });
    revalidatePath("/configuracion");
    return { success: true as const, data: serializeUser(updated) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo actualizar el rol.") };
  }
}

export async function toggleUserModuleAction(userId: string, moduleKey: string) {
  try {
    const actor = await requireUserAdmin();
    if (!validModules.has(moduleKey)) throw new Error("Módulo inválido.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const allowedModules = user.allowedModules.includes(moduleKey)
      ? user.allowedModules.filter((key) => key !== moduleKey)
      : [...user.allowedModules, moduleKey];
    const updated = await prisma.user.update({ where: { id: userId }, data: { allowedModules } });
    await logAudit({ userId: actor.id, action: "user.modules.update", module: "configuracion", entityType: "user", entityId: userId, afterData: { moduleKey, enabled: allowedModules.includes(moduleKey) } });
    revalidatePath("/configuracion");
    return { success: true as const, data: serializeUser(updated) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo actualizar el módulo.") };
  }
}

export async function toggleUserStatusAction(userId: string) {
  try {
    const actor = await requireUserAdmin();
    if (userId === actor.id) return { success: false as const, error: "No puedes bloquear tu cuenta actual." };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const updated = await prisma.user.update({ where: { id: userId }, data: { status: user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE" } });
    await logAudit({ userId: actor.id, action: "user.status.update", module: "configuracion", entityType: "user", entityId: userId, afterData: { status: updated.status } });
    revalidatePath("/configuracion");
    return { success: true as const, data: serializeUser(updated) };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo cambiar el estado.") };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const actor = await requireUserAdmin();
    if (userId === actor.id) return { success: false as const, error: "La cuenta actual está protegida." };
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, email: true, roleCode: true } });
    if (!existing) return { success: false as const, error: "Usuario no encontrado." };
    await prisma.user.update({ where: { id: userId }, data: { status: "BLOCKED" } });
    await logAudit({ userId: actor.id, action: "user.archive", module: "configuracion", entityType: "user", entityId: userId, beforeData: existing, afterData: { status: "BLOCKED" } });
    revalidatePath("/configuracion");
    return { success: true as const, message: "Usuario bloqueado; su historial fue conservado." };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo eliminar el usuario.") };
  }
}

export async function deleteAccessRequestAction(requestId: string) {
  try {
    const actor = await requireUserAdmin();
    const existing = await prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { success: false as const, error: "Solicitud no encontrada." };
    if (existing.status !== "PENDING") return { success: false as const, error: "Las solicitudes procesadas se conservan como historial." };
    const archived = await prisma.accessRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
    await logAudit({
      userId: actor.id,
      action: "access_request.archive",
      module: "configuracion",
      entityType: "access_request",
      entityId: archived.id,
      beforeData: { email: existing.email, status: existing.status },
      afterData: { status: archived.status },
    });
    revalidatePath("/configuracion");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true as const, message: "Solicitud rechazada y conservada en el historial." };
  } catch (error) {
    return { success: false as const, error: messageFrom(error, "No se pudo eliminar la solicitud.") };
  }
}
