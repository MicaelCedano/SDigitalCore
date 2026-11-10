process.env.MCP_API_KEY = "static-test-key";
process.env.MCP_OAUTH_PASSWORD = "clave-dueno-test";
process.env.MCP_OAUTH_SIGNING_SECRET = "signing-secret-for-oauth-tests";
delete process.env.MCP_PUBLIC_URL;

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DELETE, GET, POST } from "../app/api/mcp/route";
import { MCP_TOOL_NAMES } from "../lib/mcp/server";
import {
  handleAuthorizationServerMetadata,
  handleAuthorize,
  handleProtectedResourceMetadata,
  handleRegister,
  handleToken,
  isAllowedRedirectUri,
  logCompleted,
  pkceS256,
  requestPath,
} from "../lib/mcp/oauth";

const BASE = "http://127.0.0.1:3210";
const REDIRECT = `${BASE}/callback`;
const UNAUTHORIZED_MESSAGE =
  'No autorizado. Debe incluir el encabezado "Authorization: Bearer <MCP_API_KEY>" o "x-api-key".';

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(path: string, params: URLSearchParams): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
}

function mcpRequest(method: string, authorization?: string, apiKey?: string) {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  if (authorization) headers.authorization = authorization;
  if (apiKey) headers["x-api-key"] = apiKey;
  return new Request(`${BASE}/api/mcp`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) : undefined,
  });
}

async function run() {
  assert.equal(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(isAllowedRedirectUri("https://chatgpt.com/connector/oauth/abc"), true);
  assert.equal(isAllowedRedirectUri("https://chat.openai.com/connector/oauth/callback"), true);
  assert.equal(isAllowedRedirectUri("https://evil.example/steal"), false);
  assert.equal(isAllowedRedirectUri("https://chatgpt.com.evil.com/steal"), false);
  assert.equal(isAllowedRedirectUri("http://127.0.0.1:3210/callback"), true);
  assert.equal(pkceS256("a".repeat(43)).length > 0, true);

  const metadata = await handleProtectedResourceMetadata(new Request(`${BASE}/.well-known/oauth-protected-resource`));
  const prm = await metadata.json();
  assert.equal(prm.resource, `${BASE}/api/mcp`);
  assert.equal(prm.resource_name, "SDigitalCore");
  assert.deepEqual(prm.authorization_servers, [BASE]);

  const asMeta = await (await handleAuthorizationServerMetadata(new Request(`${BASE}/.well-known/oauth-authorization-server`))).json();
  assert.equal(asMeta.issuer, BASE);
  assert.equal(asMeta.token_endpoint_auth_methods_supported.includes("none"), true);
  assert.ok(asMeta.code_challenge_methods_supported.includes("S256"));

  const evil = await handleRegister(jsonRequest("/oauth/register", {
    client_name: "Evil",
    redirect_uris: ["https://evil.example/steal"],
    token_endpoint_auth_method: "none",
  }));
  assert.equal(evil.status, 400);

  const registered = await handleRegister(jsonRequest("/oauth/register", {
    client_name: "ChatGPT",
    redirect_uris: [REDIRECT, "https://chatgpt.com/connector_platform_oauth_redirect"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }));
  assert.equal(registered.status, 201);
  const client = await registered.json();
  assert.equal(client.token_endpoint_auth_method, "none");

  const codeVerifier = randomBytes(32).toString("base64url");
  const fields = {
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: pkceS256(codeVerifier),
    code_challenge_method: "S256",
    state: "estado-oauth",
    scope: "mcp:tools",
    resource: prm.resource,
    decision: "approve",
  };
  const page = await handleAuthorize(new Request(`${BASE}/oauth/authorize?${new URLSearchParams(fields)}`));
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Clave del dueño/);

  const wrong = await handleAuthorize(formRequest("/oauth/authorize", new URLSearchParams({ ...fields, password: "no" })));
  assert.match(await wrong.text(), /Clave incorrecta/);

  const approved = await handleAuthorize(formRequest("/oauth/authorize", new URLSearchParams({ ...fields, password: process.env.MCP_OAUTH_PASSWORD || "" })));
  assert.equal(approved.status, 303);
  const location = new URL(approved.headers.get("location") || "");
  assert.equal(location.searchParams.get("iss"), BASE);
  const code = location.searchParams.get("code") || "";

  const tokenResponse = await handleToken(formRequest("/oauth/token", new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
    client_id: client.client_id,
    code_verifier: codeVerifier,
  })));
  const tokenText = await tokenResponse.text();
  assert.equal(tokenResponse.status, 200, tokenText);
  const tokens = JSON.parse(tokenText);
  assert.equal(tokens.token_type, "Bearer");

  const mismatchedVerifier = randomBytes(32).toString("base64url");
  const secondApproved = await handleAuthorize(formRequest("/oauth/authorize", new URLSearchParams({
    ...fields,
    code_challenge: pkceS256(mismatchedVerifier),
    password: process.env.MCP_OAUTH_PASSWORD || "",
  })));
  const secondCode = new URL(secondApproved.headers.get("location") || "").searchParams.get("code") || "";
  const mismatched = await handleToken(formRequest("/oauth/token", new URLSearchParams({
    grant_type: "authorization_code",
    code: secondCode,
    redirect_uri: REDIRECT,
    client_id: client.client_id,
    code_verifier: mismatchedVerifier,
    resource: "https://evil.example/api/mcp",
  })));
  assert.equal(mismatched.status, 400);
  assert.equal((await mismatched.json()).error, "invalid_target");

  const withOauth = await POST(mcpRequest("POST", `Bearer ${tokens.access_token}`) as never);
  const oauthText = await withOauth.text();
  assert.equal(withOauth.status, 200, oauthText);
  for (const name of MCP_TOOL_NAMES) assert.ok(oauthText.includes(name), `falta ${name}`);
  assert.equal(oauthText.includes("precio_costo") || oauthText.includes("costo"), true);

  const withStatic = await POST(mcpRequest("POST", `Bearer ${process.env.MCP_API_KEY}`) as never);
  assert.equal(withStatic.status, 200);

  const missing = await POST(mcpRequest("POST") as never);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get("www-authenticate") || "", /resource_metadata="http:\/\/127\.0\.0\.1:3210\/\.well-known\/oauth-protected-resource"/);
  assert.equal((await missing.json()).error.message, UNAUTHORIZED_MESSAGE);

  const previous = process.env.MCP_API_KEY;
  delete process.env.MCP_API_KEY;
  const stillClosed = await POST(mcpRequest("POST") as never);
  process.env.MCP_API_KEY = previous;
  assert.equal(stillClosed.status, 401, "Sin clave estática el MCP sigue exigiendo un token");

  const started = Date.now();
  const authedGet = await GET(mcpRequest("GET", `Bearer ${tokens.access_token}`) as never);
  const getMs = Date.now() - started;
  const getText = await authedGet.text();
  assert.equal(authedGet.status, 405, getText);
  assert.ok(getMs < 1500, `GET tardó ${getMs}ms`);
  const allow = authedGet.headers.get("allow") || "";
  assert.ok(allow.includes("POST") && allow.includes("OPTIONS"), allow);
  assert.equal(getText.includes("keepalive"), false);

  const authedDelete = await DELETE(mcpRequest("DELETE", `Bearer ${process.env.MCP_API_KEY}`) as never);
  assert.equal(authedDelete.status, 405);
  const openGet = await GET(mcpRequest("GET") as never);
  assert.equal(openGet.status, 401);
  assert.match(openGet.headers.get("www-authenticate") || "", /resource_metadata=/);

  assert.equal(requestPath(new Request(`${BASE}/api/mcp?access_token=SECRETO`)), "/api/mcp");
  assert.equal(
    requestPath(new Request(`${BASE}/api/oauth/metadata/protected-resource/api/mcp`)),
    "/.well-known/oauth-protected-resource/api/mcp",
  );
  const secret = "TOKEN-SECRETO-NO-LOGUEAR";
  const lines: string[] = [];
  const original = console.info;
  console.info = (message?: unknown) => {
    lines.push(String(message));
  };
  logCompleted(new Request(`${BASE}/oauth/token?code=${secret}`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "user-agent": "ChatGPT-Test" } }), 200, Date.now());
  console.info = original;
  const line = lines.at(-1) || "";
  assert.equal(line.includes(secret), false);
  assert.match(line, /ChatGPT-Test/);

  console.log("OAuth del MCP de SDigitalCore verificado.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
