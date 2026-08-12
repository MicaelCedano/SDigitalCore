import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getRevisionBatchDetailAction } from "@/modules/qc/actions/revision-batch";
import { RevisionBatchDetailView } from "@/modules/qc/components/RevisionBatchDetailView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await getRevisionBatchDetailAction(id);
  if (!res.success || !res.data) {
    return { title: "Lote no encontrado | SDigitalCore" };
  }
  return {
    title: `Lote ${res.data.batchNumber} | Control de Calidad`,
    description: `Detalle del Lote de Revisión ${res.data.batchNumber} de ${res.data.supplierName}`,
  };
}

export default async function RevisionBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("qc.read");
  const { id } = await params;
  const res = await getRevisionBatchDetailAction(id);

  if (!res.success || !res.data) {
    notFound();
  }

  const persisted = await getPersistedCurrentUser();

  return <RevisionBatchDetailView batch={res.data} isAdmin={persisted?.roleCode === "ADMIN"} />;
}
