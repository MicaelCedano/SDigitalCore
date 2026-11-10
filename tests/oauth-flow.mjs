import { randomBytes, createHash } from "node:crypto";

const base = process.env.BASE_URL;
if (!base) {
  console.log("oauth-flow: define BASE_URL para probar el servidor ya levantado. Las pruebas en proceso están en tests/oauth.test.ts.");
  process.exit(0);
}

const redirect = `${base}/callback`;
const pkce = (verifier) => createHash("sha256").update(verifier).digest("base64url");

async function mcp(path, authorization, method = "POST") {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      accept: "application/json, text/event-stream",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...(authorization ? { authorization } : {}),
    },
    body: method === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) : undefined,
    signal: AbortSignal.timeout(2000),
  });
  return { response, text: await response.text(), ms: 0 };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const unauth = await mcp("/api/mcp");
assert(unauth.response.status === 401, `401 esperado, llegó ${unauth.response.status}`);
assert((unauth.response.headers.get("www-authenticate") || "").includes("resource_metadata="), "sin resource_metadata");

const prm = await (await fetch(`${base}/.well-known/oauth-protected-resource`)).json();
assert(prm.resource === `${base}/api/mcp`, JSON.stringify(prm));
const pathMetadata = await fetch(`${base}/.well-known/oauth-protected-resource/api/mcp`);
assert(pathMetadata.status === 200, "metadata con ruta");
const asMeta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
assert(asMeta.code_challenge_methods_supported.includes("S256"), "falta S256");
assert(asMeta.token_endpoint_auth_methods_supported.includes("none"), "falta none");

const registered = await fetch(asMeta.registration_endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_name: "ChatGPT",
    redirect_uris: [redirect],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }),
});
assert(registered.status === 201, `registro ${registered.status}`);
const client = await registered.json();
const codeVerifier = randomBytes(32).toString("base64url");
const approved = await fetch(asMeta.authorization_endpoint, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: redirect,
    code_challenge: pkce(codeVerifier),
    code_challenge_method: "S256",
    state: "estado-http",
    resource: prm.resource,
    password: process.env.MCP_OAUTH_PASSWORD || "",
    decision: "approve",
  }),
});
assert(approved.status === 303, `redirect ${approved.status}`);
const code = new URL(approved.headers.get("location")).searchParams.get("code");
const tokenResponse = await fetch(asMeta.token_endpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    client_id: client.client_id,
    code_verifier: codeVerifier,
  }),
});
const tokenText = await tokenResponse.text();
assert(tokenResponse.status === 200, tokenText);
const tokens = JSON.parse(tokenText);
for (const method of ["GET", "DELETE"]) {
  const started = Date.now();
  const hung = await mcp("/api/mcp", `Bearer ${tokens.access_token}`, method);
  assert(hung.response.status === 405, `${method} ${hung.response.status}`);
  assert(Date.now() - started < 1500, `${method} tardó demasiado`);
  assert((hung.response.headers.get("allow") || "").includes("POST"), hung.response.headers.get("allow") || "");
}
console.log("Flujo OAuth HTTP verificado.");
