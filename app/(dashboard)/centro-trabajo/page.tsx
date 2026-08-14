import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { getWorkCenterData } from "@/modules/centro-trabajo/data";
import { WorkCenterClient } from "@/modules/centro-trabajo/components/WorkCenterClient";

export const metadata: Metadata = { title: "Centro de trabajo" };

export default async function WorkCenterPage() {
  await requirePermission("centro-trabajo.read");
  const data = await getWorkCenterData();
  return <WorkCenterClient {...data} />;
}
