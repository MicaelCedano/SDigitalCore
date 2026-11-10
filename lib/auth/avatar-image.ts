import { createHash } from "node:crypto";

const DATA_URL = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]*)$/i;

export type DecodedAvatar =
  | { kind: "redirect"; url: string }
  | { kind: "bytes"; contentType: string; bytes: Uint8Array };

export function avatarCacheControl(version: string | null | undefined): string {
  if (version && version.trim()) return "private, max-age=86400, immutable";
  return "private, max-age=300";
}

export function entityTag(value: Uint8Array | string): string {
  return `"${createHash("sha1").update(value).digest("hex")}"`;
}

export function matchesEntityTag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const token = part.trim();
    if (token === "*") return true;
    const value = token.startsWith("W/") ? token.slice(2).trim() : token;
    return value === etag;
  });
}

function externalAvatarUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Interpreta el valor guardado sin modificarlo: URL http(s) o data URL en base64. */
export function decodeStoredAvatar(value: string): DecodedAvatar | null {
  const stored = value.trim();
  if (!stored) return null;

  if (!stored.startsWith("data:")) {
    const redirect = externalAvatarUrl(stored);
    if (redirect) return { kind: "redirect", url: redirect };
    return null;
  }

  const match = stored.match(DATA_URL);
  if (!match) return null;
  const contentType = (match[1] || "").toLowerCase();
  if (!contentType.startsWith("image/")) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength === 0) return null;
  return { kind: "bytes", contentType, bytes: new Uint8Array(bytes) };
}
