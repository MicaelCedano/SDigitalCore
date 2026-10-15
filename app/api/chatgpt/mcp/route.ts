import { z } from "zod";
import { authenticateChatGptRequest } from "@/lib/integrations/chatgpt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).optional(),
}).strict();

const imeiArgs = z.object({ imei: z.string().regex(/^\d{15}$/) }).strict();
const listRequestsArgs = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
}).strict();
const decisionArgs = z.object({
  id: z.string().min(1).max(128),
  decision: z.enum(["APPROVED", "REJECTED"]),
  confirmedRequestCode: z.string().trim().min(1).max(40),
}).strict();
const progressArgs = z.object({
  query: z.string().trim().max(80).optional(),
  limit: z.number().int().min(1).max(25).optional(),
}).strict();

const tools = [
  {
    name: "consultar_imei",
    title: "Consultar IMEI y revisión QC",
    description: "Consulta un IMEI completo de 15 dígitos y devuelve el equipo y su historial de revisiones QC. Solo consulta; no modifica datos.",
    inputSchema: {
      type: "object",
      properties: { imei: { type: "string", pattern: "^\\d{15}$", description: "IMEI completo de 15 dígitos." } },
      required: ["imei"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "listar_solicitudes_almacen",
    title: "Listar solicitudes de Almacén",
    description: "Consulta solicitudes de Almacén. Por defecto devuelve las pendientes; máximo 25. Solo consulta; no modifica datos.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "ALL"], default: "PENDING" },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 15 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "decidir_solicitud_almacen",
    title: "Aprobar o rechazar una solicitud de Almacén",
    description: "Acción que cambia datos e inventario. Primero muestra al usuario el código, solicitante, sucursal, artículos y decisión; llama esta herramienta únicamente después de que confirme explícitamente esa solicitud. Envía el id y requestCode exactos obtenidos al listar. El servidor valida que siga pendiente, valida existencias y registra auditoría.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1, maxLength: 128 },
        decision: { type: "string", enum: ["APPROVED", "REJECTED"] },
        confirmedRequestCode: { type: "string", minLength: 1, maxLength: 40, description: "Código exacto de la solicitud que el usuario confirmó." },
      },
      required: ["id", "decision", "confirmedRequestCode"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "consultar_avance_compras",
    title: "Consultar avance de revisión QC",
    description: "Consulta el avance de los lotes QC. El porcentaje corresponde a equipos revisados, no a dinero pagado o recibido. Solo consulta; no modifica datos.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 80, description: "Número de lote o nombre de suplidor." },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 15 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function jsonRpc(id: string | number | undefined, result: unknown, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function jsonRpcError(id: string | number | undefined, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  if (!request.body) throw new Error("invalid_json");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("invalid_json");
  }
}

function toolTextResult(value: unknown, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], isError };
}

async function callCoreApi(request: Request, path: string, init?: RequestInit) {
  const key = process.env.CHATGPT_API_KEY;
  if (!key) return toolTextResult({ error: "La integración de ChatGPT no está configurada." }, true);

  try {
    const response = await fetch(new URL(path, request.url), {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers: {
        authorization: `Bearer ${key}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => ({ error: "Respuesta inválida del API de SDigitalCore." }));
    return toolTextResult(body, !response.ok);
  } catch (error) {
    console.error("ChatGPT MCP internal API request failed", error);
    return toolTextResult({ error: "No se pudo consultar SDigitalCore." }, true);
  }
}

async function callTool(request: Request, name: string, rawArgs: unknown) {
  if (name === "consultar_imei") {
    const parsed = imeiArgs.safeParse(rawArgs);
    if (!parsed.success) return toolTextResult({ error: "Indica un IMEI completo de 15 dígitos." }, true);
    return callCoreApi(request, `/api/chatgpt/v1/imei?imei=${encodeURIComponent(parsed.data.imei)}`);
  }

  if (name === "listar_solicitudes_almacen") {
    const parsed = listRequestsArgs.safeParse(rawArgs);
    if (!parsed.success) return toolTextResult({ error: "Los filtros de solicitudes no son válidos." }, true);
    const params = new URLSearchParams();
    if (parsed.data.status) params.set("status", parsed.data.status);
    if (parsed.data.limit) params.set("limit", String(parsed.data.limit));
    return callCoreApi(request, `/api/chatgpt/v1/warehouse/requests?${params.toString()}`);
  }

  if (name === "decidir_solicitud_almacen") {
    const parsed = decisionArgs.safeParse(rawArgs);
    if (!parsed.success) return toolTextResult({ error: "Indica la decisión, el id y el código exacto confirmado." }, true);
    return callCoreApi(request, `/api/chatgpt/v1/warehouse/requests/${encodeURIComponent(parsed.data.id)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision: parsed.data.decision, confirmedRequestCode: parsed.data.confirmedRequestCode }),
    });
  }

  if (name === "consultar_avance_compras") {
    const parsed = progressArgs.safeParse(rawArgs);
    if (!parsed.success) return toolTextResult({ error: "Los filtros de avance no son válidos." }, true);
    const params = new URLSearchParams();
    if (parsed.data.query) params.set("query", parsed.data.query);
    if (parsed.data.limit) params.set("limit", String(parsed.data.limit));
    return callCoreApi(request, `/api/chatgpt/v1/purchases/progress?${params.toString()}`);
  }

  return null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return new Response(null, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return Response.json({ error: "Origen no autorizado." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Origen no autorizado." }, { status: 403 });
    }
  }

  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    return new Response(null, { status: 406, headers: { "Cache-Control": "no-store" } });
  }

  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;

  let rawMessage: unknown;
  try {
    rawMessage = await readLimitedJson(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_json";
    return jsonRpcError(undefined, message === "body_too_large" ? -32600 : -32700, message === "body_too_large" ? "El mensaje excede el límite permitido." : "El cuerpo debe ser JSON válido.", message === "body_too_large" ? 413 : 400);
  }

  const parsedMessage = requestSchema.safeParse(rawMessage);
  if (!parsedMessage.success) return jsonRpcError(undefined, -32600, "Solicitud JSON-RPC inválida.", 400);

  const message = parsedMessage.data;
  if (message.id === undefined || message.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  }

  if (message.method === "initialize") {
    const protocolVersion = message.params?.protocolVersion;
    if (typeof protocolVersion !== "string" || !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])) {
      return jsonRpcError(message.id, -32602, "Versión de protocolo MCP no compatible.");
    }
    return jsonRpc(message.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "SDigitalCore", version: "1.0.0" },
      instructions: "Consulta datos solo a pedido. Antes de decidir una solicitud de Almacén, muestra sus detalles y espera confirmación explícita del usuario.",
    });
  }

  const negotiatedVersion = request.headers.get("mcp-protocol-version");
  if (!negotiatedVersion || !SUPPORTED_PROTOCOL_VERSIONS.includes(negotiatedVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])) {
    return jsonRpcError(message.id, -32600, "Falta una versión MCP válida en MCP-Protocol-Version.", 400);
  }

  if (message.method === "ping") return jsonRpc(message.id, {});
  if (message.method === "tools/list") return jsonRpc(message.id, { tools });

  if (message.method === "tools/call") {
    const params = z.object({ name: z.string().min(1).max(100), arguments: z.unknown().optional() }).safeParse(message.params);
    if (!params.success) return jsonRpcError(message.id, -32602, "Parámetros de herramienta inválidos.");
    const result = await callTool(request, params.data.name, params.data.arguments ?? {});
    if (!result) return jsonRpcError(message.id, -32602, "Herramienta desconocida.");
    return jsonRpc(message.id, result);
  }

  return jsonRpcError(message.id, -32601, "Método MCP no disponible.");
}
