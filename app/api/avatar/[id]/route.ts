import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { avatarCacheControl, decodeStoredAvatar, entityTag, matchesEntityTag } from "@/lib/auth/avatar-image";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function cachedHeaders(cacheControl: string, etag: string) {
  return {
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  const version = request.nextUrl.searchParams.get("v");
  const cacheControl = avatarCacheControl(version);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { image: true },
  });
  const stored = user?.image?.trim() ?? "";
  if (!stored) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": version?.trim() ? cacheControl : "private, no-store" },
    });
  }

  const decoded = decodeStoredAvatar(stored);
  if (!decoded) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": version?.trim() ? cacheControl : "private, no-store" },
    });
  }

  const etag = entityTag(decoded.kind === "redirect" ? decoded.url : decoded.bytes);
  const headers = cachedHeaders(cacheControl, etag);
  if (matchesEntityTag(request.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }

  if (decoded.kind === "redirect") {
    return NextResponse.redirect(decoded.url, { status: 302, headers });
  }

  return new NextResponse(Buffer.from(decoded.bytes), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": decoded.contentType,
      "Content-Length": String(decoded.bytes.byteLength),
    },
  });
}
