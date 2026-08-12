import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/helpers";
import { getUnlockRequestsAction } from "@/modules/desbloqueos/actions/unlocks";
import { UnlockAdminPanel } from "@/modules/desbloqueos/components/UnlockAdminPanel";

export const metadata: Metadata = {
  title: "Aprobar Desbloqueos | SDigitalCore",
  description: "Solicitudes de desbloqueo pendientes de aprobación y pago",
};

export default async function DesbloqueosPagosPage() {
  await requirePermission("desbloqueos.write");
  const res = await getUnlockRequestsAction();
  if (!res.success) throw new Error(res.error);

  return <UnlockAdminPanel initialRequests={res.data as any[]} />;
}
