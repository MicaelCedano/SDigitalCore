import { handleToken, logged, oauthOptions } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return logged(req, () => oauthOptions());
}

export function POST(req: Request) {
  return logged(req, () => handleToken(req));
}
