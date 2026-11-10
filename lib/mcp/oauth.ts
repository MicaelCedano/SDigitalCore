import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/** Alcance único: las mismas herramientas que el Bearer estático. */
export const MCP_SCOPE = 'mcp:tools';

const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CODE_TTL_SECONDS = 10 * 60;
const MIN_SIGNING_SECRET = 16;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

interface ClientToken {
  typ: 'client';
  iss: string;
  name: string;
  redirect_uris: string[];
  refresh: boolean;
  iat: number;
}

interface CodeToken {
  typ: 'code';
  jti: string;
  iss: string;
  cid: string;
  redirect_uri: string;
  code_challenge: string;
  resource: string;
  scope: string;
  iat: number;
  exp: number;
}

interface AccessToken {
  typ: 'access';
  jti: string;
  iss: string;
  aud: string;
  sub: 'owner';
  scope: string;
  iat: number;
  exp: number;
}

interface RefreshToken {
  typ: 'refresh';
  jti: string;
  iss: string;
  aud: string;
  sub: 'owner';
  cid: string;
  scope: string;
  iat: number;
  exp: number;
}

interface AuthorizeInput {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string | null;
  scope: string | null;
  resource: string | null;
}

const consumedCodes = new Map<string, number>();
const passwordFailures = new Map<string, { count: number; reset: number }>();

function firstHeader(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim();
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function passwordsMatch(input: string, expected: string): boolean {
  return safeEqual(sha256(input), sha256(expected));
}

export function signingSecret(): string | null {
  const secret = process.env.MCP_OAUTH_SIGNING_SECRET?.trim() || '';
  if (secret.length < MIN_SIGNING_SECRET) return null;
  return secret;
}

function oauthPassword(): string | null {
  const password = process.env.MCP_OAUTH_PASSWORD ?? '';
  if (!password) return null;
  return password;
}

export function publicOrigin(req: Request): string {
  const configured = process.env.MCP_PUBLIC_URL?.trim();
  if (configured) {
    const withScheme = configured.includes('://') ? configured : `https://${configured}`;
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('MCP_PUBLIC_URL debe usar http o https');
    }
    return `${url.protocol}//${url.host}`;
  }

  const requestUrl = new URL(req.url);
  const host =
    firstHeader(req.headers.get('x-forwarded-host')) ||
    firstHeader(req.headers.get('host')) ||
    requestUrl.host;
  const fallbackProto = requestUrl.protocol.replace(':', '').toLowerCase();
  const rawProto = firstHeader(req.headers.get('x-forwarded-proto')) || fallbackProto;
  const proto = rawProto.replace(/:$/, '').toLowerCase();
  if ((proto !== 'http' && proto !== 'https') || !host || /[\s/\\]/.test(host)) {
    throw new Error('No se pudo determinar el origen público de la petición');
  }
  return `${proto}://${host}`;
}

export function mcpResource(origin: string): string {
  return `${origin}/api/mcp`;
}

export function canonicalResource(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash || url.search) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${path}`;
}

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  const host = url.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (loopback && (url.protocol === 'http:' || url.protocol === 'https:')) return true;
  if (url.protocol !== 'https:') return false;
  return host === 'chatgpt.com' || host.endsWith('.chatgpt.com') || host === 'chat.openai.com';
}

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function signJwt(payload: object): string {
  const secret = signingSecret();
  if (!secret) throw new Error('Falta MCP_OAUTH_SIGNING_SECRET');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyJwt(token: string): unknown {
  const secret = signingSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { alg?: string };
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;
  const expected = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp <= nowSeconds()) return null;
    return payload;
  } catch {
    return null;
  }
}

function isClientToken(value: unknown): value is ClientToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as ClientToken;
  return (
    token.typ === 'client' &&
    typeof token.iss === 'string' &&
    typeof token.name === 'string' &&
    typeof token.refresh === 'boolean' &&
    Array.isArray(token.redirect_uris) &&
    token.redirect_uris.every((uri) => typeof uri === 'string')
  );
}

function isCodeToken(value: unknown): value is CodeToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as CodeToken;
  return (
    token.typ === 'code' &&
    typeof token.jti === 'string' &&
    typeof token.iss === 'string' &&
    typeof token.cid === 'string' &&
    typeof token.redirect_uri === 'string' &&
    typeof token.code_challenge === 'string' &&
    typeof token.resource === 'string' &&
    typeof token.scope === 'string' &&
    typeof token.exp === 'number'
  );
}

function isAccessToken(value: unknown): value is AccessToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as AccessToken;
  return (
    token.typ === 'access' &&
    token.sub === 'owner' &&
    typeof token.iss === 'string' &&
    typeof token.aud === 'string' &&
    typeof token.scope === 'string'
  );
}

function isRefreshToken(value: unknown): value is RefreshToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as RefreshToken;
  return (
    token.typ === 'refresh' &&
    token.sub === 'owner' &&
    typeof token.iss === 'string' &&
    typeof token.aud === 'string' &&
    typeof token.cid === 'string' &&
    typeof token.scope === 'string'
  );
}

function readClient(clientId: string, origin: string): ClientToken | null {
  if (!clientId || clientId.length > 8192) return null;
  const payload = verifyJwt(clientId);
  if (!isClientToken(payload) || payload.iss !== origin) return null;
  if (!payload.redirect_uris.every((uri) => isAllowedRedirectUri(uri))) return null;
  return payload;
}

function clientHash(clientId: string): string {
  return sha256(clientId);
}

function grantedScope(requested: string | null): { ok: true; scope: string } | { ok: false } {
  if (!requested || !requested.trim()) return { ok: true, scope: MCP_SCOPE };
  const parts = requested.split(/\s+/).filter(Boolean);
  if (parts.includes(MCP_SCOPE)) return { ok: true, scope: MCP_SCOPE };
  return { ok: false };
}

function resolvedResource(origin: string, requested: string | null): string | null {
  const expected = canonicalResource(mcpResource(origin));
  if (!requested) return expected;
  const given = canonicalResource(requested);
  if (!given || given !== expected) return null;
  return expected;
}

function consumeCode(jti: string, exp: number): boolean {
  const now = nowSeconds();
  for (const [key, expiry] of consumedCodes) {
    if (expiry <= now) consumedCodes.delete(key);
  }
  if (consumedCodes.has(jti)) return false;
  consumedCodes.set(jti, exp);
  if (consumedCodes.size > 1000) {
    const oldest = consumedCodes.keys().next().value;
    if (oldest) consumedCodes.delete(oldest);
  }
  return true;
}

function clientIp(req: Request): string {
  return firstHeader(req.headers.get('x-forwarded-for')) || req.headers.get('x-real-ip') || 'local';
}

function tooManyAttempts(ip: string): boolean {
  const entry = passwordFailures.get(ip);
  if (!entry || entry.reset < Date.now()) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = passwordFailures.get(ip);
  if (!entry || entry.reset < now) {
    passwordFailures.set(ip, { count: 1, reset: now + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
  if (passwordFailures.size > 1000) passwordFailures.clear();
}

function clearFailures(ip: string): void {
  passwordFailures.delete(ip);
}

function json(body: unknown, status: number, extra?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...extra } });
}

export function requestPath(req: Request): string {
  let pathname = 'unknown';
  try {
    pathname = new URL(req.url).pathname;
  } catch {
    return pathname;
  }
  if (pathname === '/api/oauth/metadata/authorization-server') {
    return '/.well-known/oauth-authorization-server';
  }
  const prefix = '/api/oauth/metadata/protected-resource';
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `/.well-known/oauth-protected-resource${pathname.slice(prefix.length)}`;
  }
  return pathname;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 300);
}

export function logCompleted(req: Request, status: number, started: number): void {
  console.info(
    JSON.stringify({
      method: req.method,
      path: requestPath(req),
      status,
      durationMs: Date.now() - started,
      userAgent: oneLine(req.headers.get('user-agent') || ''),
    })
  );
}

export async function logged(req: Request, run: () => Promise<Response> | Response): Promise<Response> {
  const started = Date.now();
  try {
    const response = await run();
    logCompleted(req, response.status, started);
    return response;
  } catch (error) {
    logCompleted(req, 500, started);
    throw error;
  }
}

function oauthError(status: number, error: string, description: string): Response {
  return json({ error, error_description: description }, status);
}

export function oauthOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'SDigitalCore',
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}

export function wwwAuthenticate(origin: string, error?: 'invalid_token'): string {
  const parts = [
    'Bearer realm="sdigitalcore-mcp"',
    `resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    `scope="${MCP_SCOPE}"`,
  ];
  if (error) {
    parts.push('error="invalid_token"');
    parts.push('error_description="Token ausente o invalido"');
  }
  return parts.join(', ');
}

function staticSecret(): string | null {
  const secret = process.env.MCP_API_KEY?.trim() || '';
  return secret.length > 0 ? secret : null;
}

function presentedBearer(req: Request): { token: string; anyCredential: boolean } {
  const authHeader = req.headers.get('authorization') || '';
  const apiKey = (req.headers.get('x-api-key') || '').trim();
  const token = /^Bearer\s+/i.test(authHeader)
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : authHeader.trim();
  return { token, anyCredential: Boolean(token || apiKey) };
}

function matchesStaticSecret(req: Request, secret: string): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const apiKey = (req.headers.get('x-api-key') || '').trim();
  const token = /^Bearer\s+/i.test(authHeader)
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : authHeader.trim();
  return (token.length > 0 && passwordsMatch(token, secret)) || (apiKey.length > 0 && passwordsMatch(apiKey, secret));
}

export function isValidAccessToken(token: string, origin: string): boolean {
  const payload = verifyJwt(token);
  if (!isAccessToken(payload)) return false;
  if (payload.iss !== origin) return false;
  const audience = canonicalResource(payload.aud);
  const expected = canonicalResource(mcpResource(origin));
  if (!audience || audience !== expected) return false;
  return payload.scope.split(/\s+/).includes(MCP_SCOPE);
}

export function authorizeMcpRequest(req: Request): { ok: true } | { ok: false; challenge: string } {
  let origin = '';
  try {
    origin = publicOrigin(req);
  } catch {
    origin = '';
  }
  const secret = staticSecret();
  if (secret && matchesStaticSecret(req, secret)) return { ok: true };

  const { token, anyCredential } = presentedBearer(req);
  if (origin && token && isValidAccessToken(token, origin)) return { ok: true };
  const challenge = origin
    ? wwwAuthenticate(origin, anyCredential ? 'invalid_token' : undefined)
    : 'Bearer realm="sdigitalcore-mcp"';
  return { ok: false, challenge };
}

export function handleProtectedResourceMetadata(req: Request): Response {
  try {
    return json(protectedResourceMetadata(publicOrigin(req)), 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de configuración';
    return oauthError(500, 'server_error', message);
  }
}

export function handleAuthorizationServerMetadata(req: Request): Response {
  try {
    return json(authorizationServerMetadata(publicOrigin(req)), 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de configuración';
    return oauthError(500, 'server_error', message);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(body: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Autorizar SDigitalCore</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f4f6f8; color: #0f172a; }
    main { max-width: 420px; margin: 8vh auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { line-height: 1.45; color: #334155; }
    label { display: block; font-weight: 600; margin: 18px 0 6px; }
    input[type=password] { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 1rem; }
    .actions { display: flex; gap: 8px; margin-top: 18px; }
    button { border: 0; border-radius: 10px; padding: 12px 14px; font-weight: 600; cursor: pointer; }
    button.primary { background: #0f172a; color: #fff; flex: 1; }
    button.secondary { background: #e2e8f0; color: #0f172a; }
    .error { background: #fef2f2; color: #991b1b; border-radius: 10px; padding: 10px 12px; }
    .host { font-family: ui-monospace, monospace; font-size: .9rem; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://chat.openai.com",
    },
  });
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

function authorizeForm(input: AuthorizeInput, clientName: string, message?: string): string {
  const host = (() => {
    try {
      return new URL(input.redirectUri).host;
    } catch {
      return input.redirectUri;
    }
  })();
  return `
    <h1>Autorizar acceso</h1>
    <p><strong>${escapeHtml(clientName)}</strong> quiere usar las herramientas de SDigitalCore.</p>
    <p>El acceso vuelve a <span class="host">${escapeHtml(host)}</span>. Escribe la clave del dueño para continuar.</p>
    ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
    <form method="post" action="/oauth/authorize" accept-charset="UTF-8">
      ${hidden('response_type', input.responseType)}
      ${hidden('client_id', input.clientId)}
      ${hidden('redirect_uri', input.redirectUri)}
      ${hidden('code_challenge', input.codeChallenge)}
      ${hidden('code_challenge_method', input.codeChallengeMethod)}
      ${input.state !== null ? hidden('state', input.state) : ''}
      ${input.scope ? hidden('scope', input.scope) : ''}
      ${input.resource ? hidden('resource', input.resource) : ''}
      <label for="password">Clave del dueño</label>
      <input id="password" name="password" type="password" autocomplete="current-password" maxlength="200" required autofocus>
      <div class="actions">
        <button class="secondary" type="submit" name="decision" value="deny" formnovalidate>Cancelar</button>
        <button class="primary" type="submit" name="decision" value="approve">Autorizar</button>
      </div>
    </form>`;
}

function redirectBack(
  redirectUri: string,
  issuer: string,
  params: Record<string, string | null>,
  status: 302 | 303
): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  url.searchParams.set('iss', issuer);
  return new Response(null, {
    status,
    headers: { ...CORS_HEADERS, Location: url.toString(), 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
}

function readAuthorizeParams(sp: URLSearchParams): AuthorizeInput {
  return {
    responseType: sp.get('response_type') || '',
    clientId: sp.get('client_id') || '',
    redirectUri: sp.get('redirect_uri') || '',
    codeChallenge: sp.get('code_challenge') || '',
    codeChallengeMethod: sp.get('code_challenge_method') || '',
    state: sp.has('state') ? (sp.get('state') ?? '') : null,
    scope: sp.get('scope'),
    resource: sp.get('resource'),
  };
}

function validateAuthorize(
  origin: string,
  input: AuthorizeInput,
  status: 302 | 303
):
  | { ok: true; client: ClientToken; scope: string; resource: string }
  | { ok: false; response: Response } {
  const client = readClient(input.clientId, origin);
  const redirectOk =
    !!client && client.redirect_uris.includes(input.redirectUri) && isAllowedRedirectUri(input.redirectUri);

  const fail = (error: string, description: string, htmlStatus = 400) => {
    if (redirectOk) {
      return {
        ok: false as const,
        response: redirectBack(
          input.redirectUri,
          origin,
          { error, error_description: description, state: input.state },
          status
        ),
      };
    }
    return { ok: false as const, response: htmlPage(`<h1>No se pudo autorizar</h1><p>${escapeHtml(description)}</p>`, htmlStatus) };
  };

  if (!client) return fail('invalid_request', 'El cliente OAuth no es válido.');
  if (!redirectOk) return fail('invalid_request', 'La dirección de retorno no está permitida.');
  if (input.responseType !== 'code') return fail('unsupported_response_type', 'Solo se admite response_type=code.');
  if (!input.codeChallenge || input.codeChallengeMethod !== 'S256') {
    return fail('invalid_request', 'PKCE con S256 es obligatorio.');
  }
  const scope = grantedScope(input.scope);
  if (!scope.ok) return fail('invalid_scope', `El alcance permitido es ${MCP_SCOPE}.`);
  const resource = resolvedResource(origin, input.resource);
  if (!resource) return fail('invalid_target', 'El parámetro resource no corresponde a este servidor.');
  return { ok: true, client, scope: scope.scope, resource };
}

function issueCode(origin: string, input: AuthorizeInput, resource: string, scope: string): string {
  const issuedAt = nowSeconds();
  return signJwt({
    typ: 'code',
    jti: randomUUID(),
    iss: origin,
    cid: clientHash(input.clientId),
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    resource,
    scope,
    iat: issuedAt,
    exp: issuedAt + CODE_TTL_SECONDS,
  } satisfies CodeToken);
}

function issueAccessToken(origin: string, resource: string, scope: string): { token: string; expiresIn: number } {
  const issuedAt = nowSeconds();
  return {
    expiresIn: ACCESS_TTL_SECONDS,
    token: signJwt({
      typ: 'access',
      jti: randomUUID(),
      iss: origin,
      aud: resource,
      sub: 'owner',
      scope,
      iat: issuedAt,
      exp: issuedAt + ACCESS_TTL_SECONDS,
    } satisfies AccessToken),
  };
}

function issueRefreshToken(origin: string, clientId: string, resource: string, scope: string): string {
  const issuedAt = nowSeconds();
  return signJwt({
    typ: 'refresh',
    jti: randomUUID(),
    iss: origin,
    aud: resource,
    sub: 'owner',
    cid: clientHash(clientId),
    scope,
    iat: issuedAt,
    exp: issuedAt + REFRESH_TTL_SECONDS,
  } satisfies RefreshToken);
}

function tokenResponse(access: { token: string; expiresIn: number }, refresh: string | null, scope: string): Response {
  return json(
    {
      access_token: access.token,
      token_type: 'Bearer',
      expires_in: access.expiresIn,
      scope,
      ...(refresh ? { refresh_token: refresh } : {}),
    },
    200
  );
}

async function readParams(req: Request): Promise<URLSearchParams> {
  const text = await req.text();
  if (text.length > 65536) throw new Error('Cuerpo demasiado grande');
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = JSON.parse(text) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') params.set(key, value);
    }
    return params;
  }
  return new URLSearchParams(text);
}

export async function handleRegister(req: Request): Promise<Response> {
  if (!signingSecret()) {
    return oauthError(500, 'server_error', 'Falta MCP_OAUTH_SIGNING_SECRET (mínimo 16 caracteres).');
  }
  let origin: string;
  try {
    origin = publicOrigin(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de configuración';
    return oauthError(500, 'server_error', message);
  }

  let data: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 32768) return oauthError(400, 'invalid_client_metadata', 'Cuerpo demasiado grande.');
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return oauthError(400, 'invalid_client_metadata', 'Se esperaba un objeto JSON.');
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return oauthError(400, 'invalid_client_metadata', 'El registro debe enviarse como JSON.');
  }

  const redirectUris = data.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 5) {
    return oauthError(400, 'invalid_client_metadata', 'redirect_uris debe incluir de 1 a 5 direcciones.');
  }
  if (!redirectUris.every((uri) => typeof uri === 'string' && isAllowedRedirectUri(uri))) {
    return oauthError(
      400,
      'invalid_client_metadata',
      'Solo se aceptan retornos de chatgpt.com, chat.openai.com o localhost.'
    );
  }

  let grants = ['authorization_code', 'refresh_token'];
  if (data.grant_types !== undefined) {
    if (!Array.isArray(data.grant_types) || !data.grant_types.every((grant) => typeof grant === 'string')) {
      return oauthError(400, 'invalid_client_metadata', 'grant_types no es válido.');
    }
    if (!data.grant_types.includes('authorization_code')) {
      return oauthError(400, 'invalid_client_metadata', 'Se requiere el grant authorization_code.');
    }
    grants = ['authorization_code'];
    if (data.grant_types.includes('refresh_token')) grants.push('refresh_token');
  }

  if (data.response_types !== undefined) {
    if (!Array.isArray(data.response_types) || !data.response_types.includes('code')) {
      return oauthError(400, 'invalid_client_metadata', 'response_types debe incluir code.');
    }
  }

  const authMethod = data.token_endpoint_auth_method ?? 'none';
  if (authMethod !== 'none') {
    return oauthError(400, 'invalid_client_metadata', 'El cliente debe ser público (token_endpoint_auth_method=none).');
  }

  const name = typeof data.client_name === 'string' && data.client_name.trim() ? data.client_name.trim().slice(0, 80) : 'Cliente MCP';
  const issuedAt = nowSeconds();
  const clientId = signJwt({
    typ: 'client',
    iss: origin,
    name,
    redirect_uris: redirectUris,
    refresh: grants.includes('refresh_token'),
    iat: issuedAt,
  } satisfies ClientToken);

  return json(
    {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: grants,
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: MCP_SCOPE,
    },
    201
  );
}

export async function handleAuthorize(req: Request): Promise<Response> {
  let origin: string;
  try {
    origin = publicOrigin(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de configuración';
    return htmlPage(`<h1>OAuth no disponible</h1><p>${escapeHtml(message)}</p>`, 500);
  }

  const missing: string[] = [];
  if (!signingSecret()) missing.push('MCP_OAUTH_SIGNING_SECRET');
  if (!oauthPassword()) missing.push('MCP_OAUTH_PASSWORD');
  if (missing.length) {
    return htmlPage(
      `<h1>OAuth no configurado</h1><p>Faltan variables de entorno: ${escapeHtml(missing.join(', '))}.</p>`,
      503
    );
  }

  const status: 302 | 303 = req.method === 'POST' ? 303 : 302;
  let input: AuthorizeInput;
  let decision = 'approve';
  let password = '';
  if (req.method === 'POST') {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return htmlPage('<h1>No se pudo autorizar</h1><p>El formulario no es válido.</p>', 400);
    }
    const sp = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') sp.append(key, value);
    }
    input = readAuthorizeParams(sp);
    decision = sp.get('decision') || 'approve';
    password = (sp.get('password') || '').slice(0, 200);
  } else {
    input = readAuthorizeParams(new URL(req.url).searchParams);
  }

  const validated = validateAuthorize(origin, input, status);
  if (!validated.ok) return validated.response;

  if (req.method !== 'POST') {
    return htmlPage(authorizeForm({ ...input, resource: validated.resource, scope: validated.scope }, validated.client.name));
  }

  if (decision === 'deny') {
    return redirectBack(
      input.redirectUri,
      origin,
      { error: 'access_denied', error_description: 'El dueño canceló la autorización.', state: input.state },
      303
    );
  }

  const ip = clientIp(req);
  if (tooManyAttempts(ip)) {
    return htmlPage(
      authorizeForm(
        { ...input, resource: validated.resource, scope: validated.scope },
        validated.client.name,
        'Demasiados intentos. Espera unos minutos.'
      ),
      429
    );
  }

  const expected = oauthPassword() as string;
  if (!password || !passwordsMatch(password, expected)) {
    recordFailure(ip);
    return htmlPage(
      authorizeForm(
        { ...input, resource: validated.resource, scope: validated.scope },
        validated.client.name,
        'Clave incorrecta.'
      ),
      200
    );
  }

  clearFailures(ip);
  const code = issueCode(origin, input, validated.resource, validated.scope);
  return redirectBack(input.redirectUri, origin, { code, state: input.state }, 303);
}

function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return safeEqual(pkceS256(verifier), challenge);
}

export async function handleToken(req: Request): Promise<Response> {
  if (!signingSecret()) {
    return oauthError(500, 'server_error', 'Falta MCP_OAUTH_SIGNING_SECRET (mínimo 16 caracteres).');
  }
  let origin: string;
  try {
    origin = publicOrigin(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de configuración';
    return oauthError(500, 'server_error', message);
  }

  let params: URLSearchParams;
  try {
    params = await readParams(req);
  } catch {
    return oauthError(400, 'invalid_request', 'No se pudo leer el cuerpo de la petición.');
  }

  const grant = params.get('grant_type') || '';
  const clientId = params.get('client_id') || '';
  const client = readClient(clientId, origin);
  if (!client) return oauthError(401, 'invalid_client', 'client_id no es válido.');

  if (grant === 'authorization_code') {
    const code = params.get('code') || '';
    const redirectUri = params.get('redirect_uri') || '';
    const verifier = params.get('code_verifier') || '';
    const payload = verifyJwt(code);
    if (!isCodeToken(payload) || payload.iss !== origin) {
      return oauthError(400, 'invalid_grant', 'El código de autorización no es válido o venció.');
    }
    if (payload.cid !== clientHash(clientId) || payload.redirect_uri !== redirectUri) {
      return oauthError(400, 'invalid_grant', 'El código no corresponde a este cliente.');
    }
    const resource = resolvedResource(origin, params.get('resource') || payload.resource);
    if (!resource || resource !== payload.resource) {
      return oauthError(400, 'invalid_target', 'El parámetro resource no coincide.');
    }
    if (!pkceMatches(verifier, payload.code_challenge)) {
      return oauthError(400, 'invalid_grant', 'PKCE no coincide.');
    }
    if (!consumeCode(payload.jti, payload.exp)) {
      return oauthError(400, 'invalid_grant', 'El código ya fue usado.');
    }
    const access = issueAccessToken(origin, resource, payload.scope);
    const refresh = client.refresh ? issueRefreshToken(origin, clientId, resource, payload.scope) : null;
    return tokenResponse(access, refresh, payload.scope);
  }

  if (grant === 'refresh_token') {
    if (!client.refresh) return oauthError(400, 'unauthorized_client', 'Este cliente no puede renovar tokens.');
    const payload = verifyJwt(params.get('refresh_token') || '');
    if (!isRefreshToken(payload) || payload.iss !== origin || payload.cid !== clientHash(clientId)) {
      return oauthError(400, 'invalid_grant', 'El refresh token no es válido.');
    }
    const requested = params.get('resource');
    const resource = resolvedResource(origin, requested || payload.aud);
    if (!resource || canonicalResource(payload.aud) !== resource) {
      return oauthError(400, 'invalid_target', 'El parámetro resource no coincide.');
    }
    const access = issueAccessToken(origin, resource, payload.scope);
    const refresh = issueRefreshToken(origin, clientId, resource, payload.scope);
    return tokenResponse(access, refresh, payload.scope);
  }

  if (!grant) return oauthError(400, 'invalid_request', 'Falta grant_type.');
  return oauthError(400, 'unsupported_grant_type', 'grant_type no admitido.');
}
