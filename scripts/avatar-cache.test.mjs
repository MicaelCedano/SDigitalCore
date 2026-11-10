import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const requireReal = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();

function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const module = { exports: {} };
  modules.set(relative, module.exports);
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) => {
    if (id.startsWith("@/lib/auth/")) return load(`${id.slice(2)}.ts`);
    return requireReal(id);
  };
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  modules.set(relative, module.exports);
  return module.exports;
}

const urls = load("lib/auth/avatar-url.ts");
const images = load("lib/auth/avatar-image.ts");

const updatedAt = new Date("2026-11-10T18:00:00.000Z");
const version = urls.avatarVersion(updatedAt);
assert.equal(version, String(updatedAt.getTime()));
assert.equal(urls.avatarVersion(version), version);
assert.equal(urls.publicAvatarUrl("user_1", version), `/api/avatar/user_1?v=${version}`);
assert.notEqual(urls.avatarVersion(new Date(updatedAt.getTime() + 1)), version);
assert.equal(urls.avatarVersion(null), "0");
assert.equal(urls.publicAvatarSrc("user_1", updatedAt, false), null);

const src = urls.publicAvatarUrl("user_1", updatedAt);
assert.equal(src, `/api/avatar/user_1?v=${version}`);
assert.equal(urls.publicAvatarSrc("user_1", updatedAt, true), src);

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
const decoded = images.decodeStoredAvatar(`data:image/jpeg;base64,${jpeg}`);
assert.equal(decoded.kind, "bytes");
assert.equal(decoded.contentType, "image/jpeg");
assert.equal(Buffer.from(decoded.bytes).toString("base64"), jpeg);

const gif = images.decodeStoredAvatar("data:image/gif;charset=utf-8;base64,R0lGODlhAQABAAAAACw=");
assert.equal(gif.kind, "bytes");
assert.equal(gif.contentType, "image/gif");

assert.equal(images.decodeStoredAvatar("https://cdn.example.test/a.png").kind, "redirect");
assert.equal(images.decodeStoredAvatar("https://cdn.example.test/a.png").url, "https://cdn.example.test/a.png");
assert.equal(images.decodeStoredAvatar("http://cdn.example.test/a.webp").kind, "redirect");
assert.equal(images.decodeStoredAvatar("javascript:alert(1)"), null);
assert.equal(images.decodeStoredAvatar("data:text/plain;base64,YQ=="), null);
assert.equal(images.decodeStoredAvatar(""), null);
assert.equal(images.decodeStoredAvatar("   "), null);

assert.equal(images.avatarCacheControl("171000"), "private, max-age=86400, immutable");
assert.equal(images.avatarCacheControl(version), "private, max-age=86400, immutable");
const fresh = images.avatarCacheControl(null);
assert.match(fresh, /max-age=\d+/);
assert.equal(fresh.includes("immutable"), false);
assert.ok(Number(fresh.match(/max-age=(\d+)/)[1]) < 86400);

const etag = images.entityTag(decoded.bytes);
assert.match(etag, /^"[0-9a-f]+"$/);
assert.equal(images.matchesEntityTag(etag, etag), true);
assert.equal(images.matchesEntityTag(`W/${etag}`, etag), true);
assert.equal(images.matchesEntityTag(`"other", ${etag}`, etag), true);
assert.equal(images.matchesEntityTag("*", etag), true);
assert.equal(images.matchesEntityTag(null, etag), false);
assert.equal(images.entityTag(decoded.bytes), images.entityTag(decoded.bytes));

const lists = [
  "lib/auth/helpers.ts",
  "modules/centro-trabajo/data.ts",
  "lib/dashboard/admin-operations.ts",
  "modules/wallet/actions/withdrawals.ts",
  "app/actions/user-management.ts",
  "app/actions/profile.ts",
];
for (const file of lists) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(source.includes("image: true"), false, `${file} todavía selecciona image`);
}
const route = fs.readFileSync(path.join(root, "app/api/avatar/[id]/route.ts"), "utf8");
assert.match(route, /select:\s*\{\s*image:\s*true\s*\}/);
assert.match(route, /avatarCacheControl/);
assert.match(route, /auth\(\)/);
assert.match(fs.readFileSync(path.join(root, "lib/auth/avatar-image.ts"), "utf8"), /private, max-age=86400, immutable/);

console.log("Avatar cache: versión, data URL, redirección, ETag y selects sin image pasaron.");
