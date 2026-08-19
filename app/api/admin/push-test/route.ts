import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getFirebaseMessaging } from "@/lib/mobile/firebase-admin";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";

const payloadSchema = z.object({
  username: z.enum(["test", "admin"]).default("test"),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  route: z.enum(["/dashboard", "/almacen/transferencias", "/qc/pagos", "/garantias"]).default("/dashboard"),
});

export async function POST(request: Request) {
  const actor = await getPersistedCurrentUser();
  if (!actor || actor.status !== "ACTIVE" || actor.roleCode !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador activo puede enviar esta prueba." }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "El título y el mensaje son obligatorios." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, username: true, status: true, pushDevices: { select: { id: true, token: true } } },
  });

  if (!target) return NextResponse.json({ error: "No existe el usuario test." }, { status: 404 });
  if (target.status !== "ACTIVE") return NextResponse.json({ error: "El usuario test no está activo." }, { status: 409 });
  if (!target.pushDevices.length) {
    return NextResponse.json({ error: "El usuario test todavía no tiene un dispositivo Android registrado." }, { status: 409 });
  }

  try {
    const response = await getFirebaseMessaging().sendEachForMulticast({
      tokens: target.pushDevices.map((device) => device.token),
      notification: { title: parsed.data.title, body: parsed.data.body },
      data: { type: "admin_test", route: parsed.data.route },
      android: { notification: { channelId: "sdigitalcore" } },
    });

    const invalidDeviceIds = response.responses.flatMap((result, index) => {
      const code = result.error?.code;
      return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
        ? [target.pushDevices[index].id]
        : [];
    });
    if (invalidDeviceIds.length) {
      await prisma.pushDevice.deleteMany({ where: { id: { in: invalidDeviceIds } } });
    }

    await logAudit({
      userId: actor.id,
      action: "push.admin_test",
      module: "configuracion",
      entityType: "user",
      entityId: target.id,
      afterData: { targetUsername: target.username, route: parsed.data.route, requested: target.pushDevices.length, success: response.successCount, failure: response.failureCount },
    });

    const failures = response.responses.flatMap((result, index) => result.success ? [] : [{
      deviceId: target.pushDevices[index].id,
      code: result.error?.code ?? "messaging/unknown",
      message: result.error?.message ?? "Firebase rechazó el envío.",
    }]);

    return NextResponse.json({ sent: response.successCount, failed: response.failureCount, failures });
  } catch (error) {
    console.error("[push-test] No se pudo enviar la notificación:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo enviar la notificación." }, { status: 503 });
  }
}
