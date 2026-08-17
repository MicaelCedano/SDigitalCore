import { requirePermission } from "@/lib/auth/helpers";
import { listWarrantyDocuments } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentsList } from "@/modules/garantias/components/WarrantyDocumentsList";

export const dynamic = "force-dynamic";

export default async function WarrantyDocumentsPage() {
  await requirePermission("warranties.documents");
  const result = await listWarrantyDocuments();
  if (!result.success) {
    throw new Error(result.error);
  }

  return <WarrantyDocumentsList initialDocuments={result.data} />;
}
