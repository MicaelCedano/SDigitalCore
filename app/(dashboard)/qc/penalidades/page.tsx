import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getPenaltiesAction } from "@/modules/qc/actions/penalties";
import { PenaltiesManager } from "@/modules/qc/components/PenaltiesManager";

export const metadata: Metadata = { title: "Penalidades | SDigitalCore" };

export default async function PenalidadesPage() {
  const persisted = await getPersistedCurrentUser();
  if (!persisted || persisted.roleCode !== "ADMIN") {
    redirect("/qc");
  }

  const result = await getPenaltiesAction();
  const initialData = result.success
    ? result.data
    : { summary: { total: 0, active: 0, internalCount: 0, externalCount: 0, activeTotal: 0 }, penalties: [], technicians: [], techOptions: [] };

  return <PenaltiesManager initialData={initialData} />;
}
