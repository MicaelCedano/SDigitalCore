import { NextResponse } from "next/server";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { toAdminNotifications } from "@/lib/dashboard/notifications";

export async function GET() {
  await requireUser();
  const user = await getPersistedCurrentUser();

  if (!user || user.status !== "ACTIVE" || user.roleCode !== "ADMIN") {
    return NextResponse.json({ notifications: [], notificationCount: 0 });
  }

  const overview = await getAdminOperationsOverview(user.id);
  const notifications = overview ? toAdminNotifications(overview) : [];
  const notificationCount = overview
    ? overview.pendingWarehouseRequestCount + overview.pendingAccessRequestCount
    : 0;

  return NextResponse.json({ notifications, notificationCount });
}
