import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorizeMcpRequest, logged } from "@/lib/mcp/oauth";
import { createSdigitalMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-session-id, last-event-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
};

function unauthorized(challenge: string): Response {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: 'No autorizado. Debe incluir el encabezado "Authorization: Bearer <MCP_API_KEY>" o "x-api-key".',
      },
    },
    { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": challenge } },
  );
}

function methodNotAllowed(): Response {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } },
  );
}

async function handleMcpPost(req: Request): Promise<Response> {
  const auth = authorizeMcpRequest(req);
  if (!auth.ok) return unauthorized(auth.challenge);

  try {
    const server = createSdigitalMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message: `Error interno en servidor MCP: ${message}` } },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

async function rejectStream(req: Request): Promise<Response> {
  const auth = authorizeMcpRequest(req);
  if (!auth.ok) return unauthorized(auth.challenge);
  return methodNotAllowed();
}

export function OPTIONS(req: NextRequest) {
  return logged(req, () => new Response(null, { status: 204, headers: CORS_HEADERS }));
}

export function POST(req: NextRequest) {
  return logged(req, () => handleMcpPost(req));
}

export function GET(req: NextRequest) {
  return logged(req, () => rejectStream(req));
}

export function DELETE(req: NextRequest) {
  return logged(req, () => rejectStream(req));
}
