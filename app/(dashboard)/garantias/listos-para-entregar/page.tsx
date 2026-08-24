import { requirePermission } from "@/lib/auth/helpers";
import { ReadyForCustomerForm } from "@/modules/garantias/components/ReadyForCustomerForm";

export const metadata = { title: "Listos para entregar · Garantías" };

export default async function ReadyForCustomerPage() {
  await requirePermission("warranties.transition");
  return <ReadyForCustomerForm />;
}
