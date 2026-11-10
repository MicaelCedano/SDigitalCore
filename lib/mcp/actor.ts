import { prisma } from "@/lib/db/prisma";

export type McpActor = { id: string; roleCode: string; allowedModules: string[]; name: string | null };

export async function requireMcpActor(): Promise<McpActor> {
  const id = (process.env.MCP_ACTOR_USER_ID || process.env.CHATGPT_ACTOR_USER_ID || "").trim();
  if (!id) {
    throw new Error("Configura MCP_ACTOR_USER_ID o CHATGPT_ACTOR_USER_ID con un administrador activo.");
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roleCode: true, status: true, allowedModules: true, name: true },
  });
  if (!user || user.status !== "ACTIVE" || user.roleCode !== "ADMIN") {
    throw new Error("El actor del MCP debe ser un usuario ADMIN activo.");
  }
  return { id: user.id, roleCode: user.roleCode, allowedModules: user.allowedModules, name: user.name };
}
