import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/helpers";
import { getWarrantyDocument } from "@/modules/garantias/actions/warranty";
import { WarrantyDocumentPageView } from "@/modules/garantias/components/WarrantyDocumentPageView";
export default async function WarrantyDocumentPage({ params }: { params: Promise<{ documentCode: string }> }) { await requirePermission("warranties.documents"); const { documentCode } = await params; const result = await getWarrantyDocument(documentCode); if (!result.success) notFound(); return <WarrantyDocumentPageView doc={result.data} />; }
