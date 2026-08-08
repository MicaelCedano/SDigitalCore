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
  { key: "inventario", label: "Inventario", permission: "inventory.read", description: "Equipos y movimientos" },
  { key: "almacen", label: "Almacén", permission: "warehouse.read", description: "Ubicaciones y transferencias" },
  { key: "ventas", label: "Ventas", permission: "sales.read", description: "Órdenes y cobros" },
  { key: "taller", label: "Taller", permission: "repair.read", description: "Reparaciones" },
  { key: "rma", label: "RMA / Garantías", permission: "rma.read", description: "Garantías" },
  { key: "qc", label: "Control QC", permission: "qc.read", description: "Inspecciones QC" },
  { key: "clientes", label: "Clientes", permission: "customers.read", description: "Directorio" },
  { key: "proveedores", label: "Proveedores", permission: "suppliers.read", description: "Catálogo" },
  { key: "precios", label: "Lista de Precios", permission: "prices.read", description: "Listas de precios" },
  { key: "facturas", label: "Facturas PDF", permission: "invoices.read", description: "Comprobantes" },
  { key: "reportes", label: "Reportes", permission: "reports.read", description: "Métricas" },
  { key: "configuracion", label: "Configuración", permission: "settings.read", description: "Usuarios y roles" },
];

export const DEFAULT_ROLE_MODULES: Record<string, string[]> = {
  ADMIN: [
    "inventario", "almacen", "ventas", "taller", "rma", "qc",
    "clientes", "proveedores", "precios", "facturas", "reportes", "configuracion"
  ],
  ALMACEN: ["inventario", "almacen", "proveedores", "qc", "reportes"],
  VENTAS: ["ventas", "clientes", "precios", "facturas", "inventario", "reportes"],
  TECNICO: ["taller", "rma", "qc", "inventario"],
  QC: ["qc", "inventario", "rma", "taller"],
  SUPERVISOR: [
    "inventario", "almacen", "ventas", "taller", "rma", "qc",
    "clientes", "proveedores", "precios", "facturas", "reportes"
  ],
  PERSONALIZADO: ["inventario", "ventas"],
};

let accessRequestsStore: AccessRequest[] = [
  {
    id: "req-101",
    name: "Carlos Mendoza",
    username: "cmendoza",
    email: "carlos.mendoza@empresa.com",
    phone: "809-555-0192",
    status: "PENDING",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "req-102",
    name: "Laura Gómez",
    username: "lgomez",
    email: "laura.gomez@empresa.com",
    phone: "809-555-0144",
    status: "PENDING",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

let usersStore: SystemUser[] = [
  {
    id: "user-dev-admin",
    name: "Admin Local",
    username: "admin",
    email: "admin@sdigital.local",
    phone: "809-000-0000",
    avatarUrl: "",
    roleCode: "ADMIN",
    status: "ACTIVE",
    allowedModules: [...DEFAULT_ROLE_MODULES.ADMIN],
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-almacen-1",
    name: "Roberto Díaz",
    username: "rdiaz",
    email: "roberto.almacen@empresa.com",
    phone: "809-555-0188",
    avatarUrl: "",
    roleCode: "ALMACEN",
    status: "ACTIVE",
    allowedModules: ["inventario", "almacen", "proveedores"],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

export function getAccessRequests(): AccessRequest[] {
  return accessRequestsStore;
}

export function addAccessRequest(req: Omit<AccessRequest, "id" | "status" | "createdAt">): AccessRequest {
  const newReq: AccessRequest = {
    ...req,
    id: `req-${Date.now()}`,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  accessRequestsStore = [newReq, ...accessRequestsStore];
  return newReq;
}

export function createDirectUser(data: {
  name: string;
  username: string;
  email: string;
  phone: string;
  roleCode: string;
  allowedModules: string[];
}): SystemUser {
  const newUser: SystemUser = {
    id: `user-dir-${Date.now()}`,
    name: data.name,
    username: data.username,
    email: data.email,
    phone: data.phone,
    avatarUrl: "",
    roleCode: data.roleCode,
    status: "ACTIVE",
    allowedModules: data.allowedModules,
    createdAt: new Date().toISOString(),
  };

  usersStore = [newUser, ...usersStore];
  return newUser;
}

export function approveAccessRequest(
  reqId: string,
  roleCode: string,
  customAllowedModules?: string[]
): SystemUser | null {
  const req = accessRequestsStore.find((r) => r.id === reqId);
  if (!req) return null;

  req.status = "APPROVED";
  req.assignedRole = roleCode;

  const modulesToAssign = customAllowedModules ?? DEFAULT_ROLE_MODULES[roleCode] ?? ["inventario"];

  const newUser: SystemUser = {
    id: `user-${Date.now()}`,
    name: req.name,
    username: req.username,
    email: req.email,
    phone: req.phone,
    avatarUrl: "",
    roleCode,
    status: "ACTIVE",
    allowedModules: modulesToAssign,
    createdAt: new Date().toISOString(),
  };

  usersStore = [newUser, ...usersStore];
  return newUser;
}

export function rejectAccessRequest(reqId: string): boolean {
  const req = accessRequestsStore.find((r) => r.id === reqId);
  if (!req) return false;
  req.status = "REJECTED";
  return true;
}

export function getUsers(): SystemUser[] {
  return usersStore;
}

export function updateUserProfile(
  userIdOrEmail: string,
  data: Partial<Pick<SystemUser, "name" | "username" | "email" | "phone" | "avatarUrl">>
): SystemUser | null {
  const user = usersStore.find(
    (u) => u.id === userIdOrEmail || u.email === userIdOrEmail
  );
  if (!user) return null;

  if (data.name !== undefined) user.name = data.name;
  if (data.username !== undefined) user.username = data.username;
  if (data.email !== undefined) user.email = data.email;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;

  return user;
}

export function updateUserRole(userId: string, newRoleCode: string): boolean {
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.roleCode = newRoleCode;
  user.allowedModules = [...(DEFAULT_ROLE_MODULES[newRoleCode] ?? ["inventario"])];
  return true;
}

export function toggleUserModulePermission(userId: string, moduleKey: string): boolean {
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;

  const exists = user.allowedModules.includes(moduleKey);
  if (exists) {
    user.allowedModules = user.allowedModules.filter((m) => m !== moduleKey);
  } else {
    user.allowedModules = [...user.allowedModules, moduleKey];
  }
  return !exists;
}

export function toggleUserStatus(userId: string): boolean {
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.status = user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
  return true;
}

export function deleteUser(userId: string): boolean {
  if (userId === "user-dev-admin") return false;
  const exists = usersStore.some((user) => user.id === userId);
  if (!exists) return false;
  usersStore = usersStore.filter((user) => user.id !== userId);
  return true;
}

export function isModuleAllowedForUser(userEmail: string, moduleKey: string): boolean {
  const user = usersStore.find((u) => u.email === userEmail);
  if (!user) return true;
  if (user.roleCode === "ADMIN") return true;
  return user.allowedModules.includes(moduleKey);
}
