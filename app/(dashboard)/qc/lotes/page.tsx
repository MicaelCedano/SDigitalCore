import type { Metadata } from "next";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { RevisionBatchesList } from "@/modules/qc/components/RevisionBatchesList";

export const metadata: Metadata = {
  title: "Lotes de Revisión | Control de Calidad | SDigitalCore",
  description: "Registro de compras y lotes entrantes de mercancía para auditoría QC",
};

export default async function RevisionBatchesPage() {
  await requirePermission("qc.read");
  const persisted = await getPersistedCurrentUser();
  return <RevisionBatchesList isAdmin={persisted?.roleCode === "ADMIN"} />;
}
