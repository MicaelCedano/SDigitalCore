import { NextResponse } from "next/server";
import { can, getPersistedCurrentUser } from "@/lib/auth/helpers";

export const qcHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
export const qcJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: qcHeaders });
export async function authorizeQc(request: Request, write = false) {
  const actor = await getPersistedCurrentUser();
  if (!actor || actor.status !== "ACTIVE")
    return {
      response: qcJson(
        { error: "Tu sesión venció. Vuelve a iniciar sesión." },
        401
      ),
    };
  if (!(await can(write ? "qc.write" : "qc.read")))
    return {
      response: qcJson(
        { error: "Tu cuenta no tiene permiso para esta operación." },
        403
      ),
    };
  if (
    write &&
    (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("x-sdigitalcore-client") !== "mobile-v2" ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  )
    return { response: qcJson({ error: "Solicitud no autorizada." }, 403) };
  return { actor };
}
export async function readQcBody(
  request: Request,
  limit: number
): Promise<unknown> {
  // Bound the stream, not just a client-controlled Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Falta el contenido.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error("Contenido demasiado grande.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
