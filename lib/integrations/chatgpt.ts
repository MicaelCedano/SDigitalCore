import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export type ChatGptPrincipal = {
  id: string;
  name: string | null;
  email: string | null;
  roleCode: string;
  allowedModules: string[];
};

type AuthResult = { principal: ChatGptPrincipal; response?: never } | { principal?: never; response: NextResponse };

function unauthorized() {
  return chatGptJson({ error: "Credencial no autorizada." }, { status: 401 });
}

/** Auth para GPT Actions: una clave privada se vincula a un usuario ADMIN activo de Core. */
export async function authenticateChatGptRequest(request: Request): Promise<AuthResult> {
  const configuredKeys = [process.env.CHATGPT_API_KEY, process.env.CHATGPT_SITES_TOKEN]
    .filter((key): key is string => typeof key === "string" && key.length >= 32);
  const actorId = process.env.CHATGPT_ACTOR_USER_ID;
  if (configuredKeys.length === 0 || !actorId) {
    return {
      response: chatGptJson({ error: "La integración de ChatGPT no está configurada." }, { status: 503 }),
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedKey = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const supplied = Buffer.from(suppliedKey, "utf8");
  let authorized = false;
  for (const configuredKey of configuredKeys) {
    const expected = Buffer.from(configuredKey, "utf8");
    const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
    authorized = matches || authorized;
  }
  if (!authorized) {
    return { response: unauthorized() };
  }

  let principal;
  try {
    principal = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true, email: true, roleCode: true, allowedModules: true, status: true },
    });
  } catch (error) {
    console.error("ChatGPT integration actor lookup failed", error);
    return { response: chatGptJson({ error: "No se pudo validar la cuenta de integración." }, { status: 503 }) };
  }
  if (!principal || principal.status !== "ACTIVE" || principal.roleCode !== "ADMIN") {
    return { response: unauthorized() };
  }

  return {
    principal: {
      id: principal.id,
      name: principal.name,
      email: principal.email,
      roleCode: principal.roleCode,
      allowedModules: principal.allowedModules,
    },
  };
}

export function chatGptJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(data, { ...init, headers });
}
