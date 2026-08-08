import type { Metadata } from "next";
import { BranchesManager } from "@/modules/configuracion/components/BranchesManager";

export const metadata: Metadata = {
  title: "Gestión de Sucursales | SDigitalCore",
  description: "Administración de sucursales, almacenes y puntos operativos del sistema",
};

export default function SucursalesPage() {
  return <BranchesManager />;
}
