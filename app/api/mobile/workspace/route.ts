import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { WORKSPACE_MODULES } from "@/lib/mobile/workspace-contract";
import {
  readWorkspaceModule,
  WORKSPACE_PERMISSIONS,
} from "@/lib/mobile/workspace-data";

const schema = z.object({
  module: z
    .enum(
      WORKSPACE_MODULES.map((module) => module.key) as [
        (typeof WORKSPACE_MODULES)[number]["key"],
        ...(typeof WORKSPACE_MODULES)[number]["key"][]
      ]
    )
    .optional(),
  q: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const actor = await getPersistedCurrentUser();
  if (!actor || actor.status !== "ACTIVE")
    return NextResponse.json(
      { error: "Sesión no autorizada." },
      { status: 401, headers }
    );
  const search = new URL(request.url).searchParams;
  const parsed = schema.safeParse({
    module: search.get("module") ?? undefined,
    q: search.get("q") ?? "",
    page: search.get("page") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Consulta inválida." },
      { status: 400, headers }
    );
  const key = parsed.data.module;
  if (!key) {
    const grants = await Promise.all(
      WORKSPACE_MODULES.map((module) => can(WORKSPACE_PERMISSIONS[module.key]))
    );
    return NextResponse.json(
      { modules: WORKSPACE_MODULES.filter((_, index) => grants[index]) },
      { headers }
    );
  }
  if (!(await can(WORKSPACE_PERMISSIONS[key])))
    return NextResponse.json(
      { error: "Tu cuenta no tiene acceso a este módulo." },
      { status: 403, headers }
    );
  try {
    return NextResponse.json(
      await readWorkspaceModule(key, parsed.data.q, parsed.data.page, actor),
      { headers }
    );
  } catch (error) {
    console.error(
      `[mobile/workspace] No se pudo consultar ${key}`,
      error instanceof Error ? error.name : "Error"
    );
    return NextResponse.json(
      { error: "No se pudo cargar el módulo. Reintenta en unos momentos." },
      { status: 503, headers }
    );
  }
}
