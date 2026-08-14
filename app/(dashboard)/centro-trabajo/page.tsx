import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/helpers";
import { getWorkCenterData } from "@/modules/centro-trabajo/data";
import { WorkCenterClient } from "@/modules/centro-trabajo/components/WorkCenterClient";

export const metadata: Metadata = { title: "Centro de trabajo" };

export default async function WorkCenterPage() {
  await requireUser();
  const data = await getWorkCenterData();
  return <WorkCenterClient {...data} />;
}
