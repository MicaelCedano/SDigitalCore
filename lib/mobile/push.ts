import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getFirebaseMessaging } from "@/lib/mobile/firebase-admin";

type PushPayload = {
  title: string;
  body: string;
  route?: string;
  type?: string;
};

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** Push is best-effort: a notification failure must never roll back a business operation. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;

  try {
    const devices = await prisma.pushDevice.findMany({
      where: { userId: { in: ids }, user: { status: "ACTIVE" } },
      select: { id: true, token: true },
    });
    if (!devices.length) return;

    const invalidDeviceIds: string[] = [];
    for (const batch of chunks(devices, 500)) {
      const response = await getFirebaseMessaging().sendEachForMulticast({
        tokens: batch.map((device) => device.token),
        notification: { title: payload.title, body: payload.body },
        data: {
          type: payload.type ?? "system",
          route: payload.route ?? "/dashboard",
        },
        android: { notification: { channelId: "sdigitalcore" } },
      });
      response.responses.forEach((result, index) => {
        if (result.error?.code && INVALID_TOKEN_CODES.has(result.error.code)) invalidDeviceIds.push(batch[index].id);
      });
    }
    if (invalidDeviceIds.length) await prisma.pushDevice.deleteMany({ where: { id: { in: invalidDeviceIds } } });
  } catch (error) {
    console.error("[push] No se pudo entregar una notificación:", error instanceof Error ? error.message : error);
  }
}

export async function sendPushToRole(roleCode: string, payload: PushPayload) {
  try {
    const users = await prisma.user.findMany({ where: { roleCode, status: "ACTIVE" }, select: { id: true } });
    await sendPushToUsers(users.map((user) => user.id), payload);
  } catch (error) {
    console.error("[push] No se pudieron resolver los destinatarios:", error instanceof Error ? error.message : error);
  }
}
