import { handleAuthorizationServerMetadata, logged, oauthOptions } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return logged(req, () => oauthOptions());
}

export function GET(req: Request) {
  return logged(req, () => handleAuthorizationServerMetadata(req));
}
