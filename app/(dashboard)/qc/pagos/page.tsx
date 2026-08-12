import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getQcPaymentsAction } from "@/modules/qc/actions/revision-batch";
import { QcPaymentsView } from "@/modules/qc/components/QcPaymentsView";

export const metadata: Metadata = { title: "Pagos QC | SDigitalCore" };

export default async function QcPaymentsPage() {
  const persisted = await getPersistedCurrentUser();
  if (!persisted || persisted.roleCode !== "ADMIN") {
    redirect("/qc");
  }

  const result = await getQcPaymentsAction();
  const initialData = result.success ? result.data : { pending: [], history: [] };

  return <QcPaymentsView initialData={initialData} />;
}
