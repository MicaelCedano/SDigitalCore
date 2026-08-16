import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";

const pushTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.literal("ANDROID"),
  appVersion: z.string().trim().max(32).optional(),
});

export async function POST(request: Request) {
  const user = await getPersistedCurrentUser();
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const parsed = pushTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Token push inválido." }, { status: 400 });
  }

  const device = await prisma.pushDevice.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion,
    },
    update: {
      userId: user.id,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion,
      lastSeenAt: new Date(),
    },
    select: { id: true, platform: true },
  });

  await logAudit({
    userId: user.id,
    action: "push_device.register",
    module: "mobile",
    entityType: "push_device",
    entityId: device.id,
    afterData: {
      platform: device.platform,
      appVersion: parsed.data.appVersion ?? null,
    },
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ registered: true });
}
