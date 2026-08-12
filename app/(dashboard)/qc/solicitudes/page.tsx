import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { SolicitudesClient } from "@/modules/qc/components/SolicitudesClient";

export const metadata: Metadata = {
  title: "Solicitudes de IMEIs | Control de Calidad | SDigitalCore",
  description: "Solicitudes de IMEIs de los de control de calidad para aceptar o rechazar",
};

export default async function QcSolicitudesPage() {
  await requirePermission("qc.read");
  const persisted = await getPersistedCurrentUser();
  if (persisted?.roleCode !== "ADMIN") {
    redirect("/qc");
  }
  return <SolicitudesClient />;
}
