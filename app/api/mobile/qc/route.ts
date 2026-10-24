import { z } from "zod";
import { authorizeQc, qcJson } from "@/lib/mobile/qc-http";
import { readQc, readQcDetail } from "@/lib/mobile/qc-data";
const schema = z.object({
  deviceId: z.string().min(1).max(100).optional(),
  q: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export async function GET(request: Request) {
  try {
    const auth = await authorizeQc(request);
    if (auth.response) return auth.response;
    const search = new URL(request.url).searchParams;
    const parsed = schema.safeParse({
      deviceId: search.get("deviceId") ?? undefined,
      q: search.get("q") ?? "",
      page: search.get("page") ?? 1,
    });
    if (!parsed.success) return qcJson({ error: "Consulta inválida." }, 400);
    const data = parsed.data.deviceId
      ? await readQcDetail(auth.actor, parsed.data.deviceId)
      : await readQc(auth.actor, parsed.data.q, parsed.data.page);
    return data ? qcJson(data) : qcJson({ error: "El equipo no existe." }, 404);
  } catch {
    return qcJson(
      { error: "No se pudo cargar Calidad. Revisa la conexión y reintenta." },
      503
    );
  }
}
