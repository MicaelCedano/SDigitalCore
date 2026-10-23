/** Shared wire contract. Keep this file free of server or React dependencies. */
export const WORKSPACE_MODULES = [
  {
    key: "qc",
    name: "Control de calidad",
    subtitle: "Lotes y equipos asignados",
    path: "/qc",
    icon: "qc",
  },
  {
    key: "almacen",
    name: "Almacén",
    subtitle: "Productos, cajas y existencias",
    path: "/almacen",
    icon: "stock",
  },
  {
    key: "recibos",
    name: "Recibo de mercancía",
    subtitle: "Recepciones y equipos recibidos",
    path: "/almacen/recibos",
    icon: "receipt",
  },
  {
    key: "garantias",
    name: "Garantías",
    subtitle: "Casos, problemas y seguimiento",
    path: "/garantias",
    icon: "warranty",
  },
  {
    key: "reparaciones",
    name: "Reparaciones",
    subtitle: "Cola y trabajos reportados",
    path: "/reparaciones",
    icon: "repair",
  },
  {
    key: "desbloqueos",
    name: "Desbloqueos",
    subtitle: "Solicitudes y estado de los IMEI",
    path: "/desbloqueos",
    icon: "unlock",
  },
  {
    key: "centro-trabajo",
    name: "Centro de trabajo",
    subtitle: "Tareas y actividad del equipo",
    path: "/centro-trabajo",
    icon: "work",
  },
  {
    key: "facturas",
    name: "Facturas y conduces",
    subtitle: "Documentos y sus equipos",
    path: "/facturas",
    icon: "invoice",
  },
  {
    key: "wallet",
    name: "Mi wallet",
    subtitle: "Mis cuentas y movimientos",
    path: "/wallet",
    icon: "wallet",
  },
  {
    key: "configuracion",
    name: "Sucursales",
    subtitle: "Directorio de sucursales",
    path: "/configuracion/sucursales",
    icon: "settings",
  },
] as const;

export type WorkspaceKey = (typeof WORKSPACE_MODULES)[number]["key"];
export type WorkspaceModule = (typeof WORKSPACE_MODULES)[number];
export type WorkspaceField = { label: string; value: string };
export type WorkspaceEntry = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  status: string;
  date: string | null;
  imei?: string;
  fields: WorkspaceField[];
  lines: { title: string; subtitle: string }[];
};
export type WorkspacePage = {
  module: WorkspaceKey;
  title: string;
  entries: WorkspaceEntry[];
  metrics: WorkspaceField[];
  page: number;
  hasMore: boolean;
  /** List limits inherited from existing business readers, never a global total. */
  notice: string;
  fetchedAt: string;
};
export type WorkspaceCatalog = { modules: WorkspaceModule[] };
