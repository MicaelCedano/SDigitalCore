/**
 * Control de Permisos Granulares por Usuario y Rol — SDigitalCore
 * Incluye gestión de perfil de usuario (foto, nombre, teléfono, contraseña).
 */

export interface SystemRole {
  code: string;
  name: string;
  description: string;
  badgeColor: string;
}

export interface ModuleDefinition {
  key: string;
  label: string;
  permission: string;
  description: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  assignedRole?: string;
  customModules?: string[];
}

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  roleCode: string;
  status: "ACTIVE" | "PENDING" | "BLOCKED";
  allowedModules: string[];
  createdAt: string;
}

export const SYSTEM_ROLES: SystemRole[] = [
  { code: "ADMIN", name: "Administrador", description: "Acceso total a todos los módulos.", badgeColor: "#4f46e5" },
  { code: "ALMACEN", name: "Almacén & Inventario", description: "Gestión de existencias e IMEIs.", badgeColor: "#3b82f6" },
  { code: "VENTAS", name: "Ventas & Facturación", description: "Cotizaciones, órdenes y cobros.", badgeColor: "#10b981" },
  { code: "TECNICO", name: "Técnico / Taller", description: "Reparación y diagnóstico.", badgeColor: "#f97316" },
  { code: "QC", name: "Control de Calidad", description: "Inspecciones y checklists.", badgeColor: "#8b5cf6" },
  { code: "SUPERVISOR", name: "Supervisor", description: "Supervisión y reportes.", badgeColor: "#0284c7" },
  { code: "PERSONALIZADO", name: "Personalizado", description: "Permisos configurados a medida.", badgeColor: "#64748b" },
];

export const SYSTEM_MODULES: ModuleDefinition[] = [
  { key: "almacen", label: "Almacén", permission: "warehouse.read", description: "Ubicaciones y solicitudes" },
  { key: "precios", label: "Lista de Precios", permission: "prices.read", description: "Listas de precios" },
  { key: "facturas", label: "Facturas PDF", permission: "invoices.read", description: "Comprobantes" },
  { key: "configuracion", label: "Configuración", permission: "settings.read", description: "Usuarios y roles" },
];

export const DEFAULT_ROLE_MODULES: Record<string, string[]> = {
  ADMIN: ["almacen", "precios", "facturas", "configuracion"],
  ALMACEN: ["almacen"],
  VENTAS: ["precios", "facturas"],
  TECNICO: [],
  QC: [],
  SUPERVISOR: ["almacen", "precios", "facturas"],
  PERSONALIZADO: [],
};
