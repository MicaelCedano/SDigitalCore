"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  ScanSearch,
  Tag,
  Warehouse,
  WalletCards,
  Wrench,
  Lock,
  X,
  Sparkles,
  Truck,
} from "lucide-react";

interface SubNavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
  nonAdminOnly?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  adminHref?: string;
  moduleKey: string;
  icon: React.ElementType;
  section: "Inicio" | "Operaciones" | "Comercial" | "Administración";
  children?: SubNavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", moduleKey: "dashboard", icon: LayoutDashboard, section: "Inicio" },
  { label: "Centro de trabajo", href: "/centro-trabajo", moduleKey: "centro-trabajo", icon: BriefcaseBusiness, section: "Inicio" },
  { label: "Envíos", href: "/envios", moduleKey: "envios", icon: Truck, section: "Operaciones", children: [
    { label: "Seguimiento", href: "/envios" },
  ] },
  { label: "Almacén", href: "/almacen", moduleKey: "almacen", icon: Warehouse, section: "Operaciones", children: [
    { label: "Productos", href: "/almacen" },
    { label: "Recibo de mercancía", href: "/almacen/recibos" },
    { label: "Movimientos", href: "/almacen/movimientos", adminOnly: true },
    { label: "Solicitudes de almacén", href: "/almacen/transferencias" },
  ] },
  { label: "Control de Calidad", href: "/qc", adminHref: "/qc/lotes", moduleKey: "qc", icon: ScanSearch, section: "Operaciones", children: [
    { label: "Panel QC", href: "/qc", nonAdminOnly: true },
    { label: "Compra de lotes", href: "/qc/lotes", adminOnly: true },
    { label: "Pagos QC", href: "/qc/pagos", adminOnly: true },
    { label: "Penalidades", href: "/qc/penalidades", adminOnly: true },
    { label: "Solicitudes de IMEIs", href: "/qc/solicitudes", adminOnly: true },
    { label: "Equipos revisados", href: "/qc/equipos-revisados", adminOnly: true },
  ] },
  { label: "Reparaciones", href: "/reparaciones", adminHref: "/reparaciones/pagos", moduleKey: "reparaciones", icon: Wrench, section: "Operaciones", children: [
    { label: "Panel de reparaciones", href: "/reparaciones", nonAdminOnly: true },
    { label: "Aprobar pagos", href: "/reparaciones/pagos", adminOnly: true },
  ] },
  { label: "Desbloqueos", href: "/desbloqueos", adminHref: "/desbloqueos/pagos", moduleKey: "desbloqueos", icon: Lock, section: "Operaciones", children: [
    { label: "Panel de desbloqueos", href: "/desbloqueos", nonAdminOnly: true },
    { label: "Aprobar y pagar", href: "/desbloqueos/pagos", adminOnly: true },
  ] },
  { label: "Mi Wallet", href: "/wallet", moduleKey: "wallet", icon: WalletCards, section: "Comercial" },
  { label: "Lista de precios", href: "/precios", moduleKey: "precios", icon: Tag, section: "Comercial" },
  { label: "Facturas", href: "/facturas", moduleKey: "facturas", icon: FileText, section: "Comercial" },
  { label: "Gestión de Garantías", href: "/garantias", moduleKey: "garantias", icon: ShieldCheck, section: "Operaciones", children: [
    { label: "Panel de casos", href: "/garantias" },
    { label: "Registrar ingreso", href: "/garantias/ingreso" },
    { label: "Entrega a técnico", href: "/garantias/tecnicos/entrega" },
    { label: "Recepción de técnico", href: "/garantias/tecnicos/recepcion" },
    { label: "Envío a suplidor", href: "/garantias/suplidores/envio" },
    { label: "Recepción de suplidor", href: "/garantias/suplidores/recepcion" },
    { label: "Despacho al cliente", href: "/garantias/despacho" },
    { label: "Nota de crédito", href: "/garantias/nota-credito" },
    { label: "Documentos", href: "/garantias/historial/documentos" },
  ] },
  { label: "Recibo de mercancía", href: "/almacen/recibos", moduleKey: "almacen", icon: ClipboardList, section: "Operaciones" },
  { label: "Configuración", href: "/configuracion", moduleKey: "configuracion", icon: Settings, section: "Administración", children: [
    { label: "Usuarios y permisos", href: "/configuracion" },
    { label: "Prueba de notificaciones", href: "/configuracion/notificaciones", adminOnly: true },
    { label: "Sucursales", href: "/configuracion/sucursales" },
    { label: "Direcciones de envío", href: "/configuracion/direcciones-envio" },
    { label: "Clientes y proveedores", href: "/configuracion/clientes-proveedores" },
    { label: "Proveedores de control de calidad", href: "/configuracion/proveedores-qc" },
    { label: "Imágenes de QC", href: "/configuracion/imagenes-qc" },
    { label: "Migración de usuarios y wallets", href: "/configuracion/migracion-usuarios", adminOnly: true },
  ] },
];

interface SidebarProps {
  allowedModules?: string[];
  roleCode?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  allowedModules,
  roleCode,
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const allowedModuleSet = allowedModules ? new Set(allowedModules) : null;
  const visibleItems = navItems.filter((item) =>
    item.moduleKey === "dashboard" || allowedModuleSet === null || allowedModuleSet.has(item.moduleKey),
  );
  const sections = ["Inicio", "Operaciones", "Comercial", "Administración"] as const;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar navegación"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-[opacity,backdrop-filter] duration-300 ease-out md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[12px_0_32px_-20px_rgba(15,23,42,0.35)] transition-[width,transform,box-shadow] duration-300 ease-out will-change-transform print:hidden md:relative md:translate-x-0 md:shadow-none ${
          collapsed ? "w-[76px]" : "w-[276px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className={`flex h-[72px] items-center border-b border-slate-100 ${collapsed ? "justify-center px-3" : "justify-between px-5"}`}>
          <Link href="/dashboard" className="focus-ring flex min-w-0 items-center gap-3 rounded-xl p-1 transition-opacity hover:opacity-90" onClick={onMobileClose}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <Image src="/logo.png" alt="" width={34} height={34} className="h-7 w-7 object-contain" priority unoptimized />
            </span>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold tracking-tight text-slate-900">SDigitalCore</span>
                <span className="block text-[10px] font-semibold text-indigo-600">Enterprise Suite</span>
              </div>
            ) : null}
          </Link>
          {!collapsed ? (
            <button type="button" onClick={onMobileClose} className="focus-ring rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 md:hidden cursor-pointer" aria-label="Cerrar menú">
              <X size={19} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="focus-ring hidden rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 md:flex"
            aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
            title={collapsed ? "Expandir barra" : "Colapsar barra"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        {/* Navigation items */}
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {sections.map((section) => {
            const items = visibleItems.filter((item) => item.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="last:mb-0">
                {!collapsed ? <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{section}</p> : null}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const targetHref = roleCode === "ADMIN" && item.adminHref ? item.adminHref : item.href;
                    const active = item.href === "/almacen" && pathname.startsWith("/almacen/recibos") ? false : isActive(item.href);
                    const open = expandedMenu === item.moduleKey || (expandedMenu === null && active);

                    const filteredChildren = (item.children || []).filter((child) => {
                      if (child.href === "/almacen/recibos") return false;
                      if (child.adminOnly && roleCode !== "ADMIN") return false;
                      if (child.nonAdminOnly && roleCode === "ADMIN") return false;
                      return true;
                    });

                    return (
                      <div key={item.href}>
                        <div className="relative flex items-center">
                          <Link
                            href={targetHref}
                            onClick={() => {
                              if (filteredChildren.length) setExpandedMenu(item.moduleKey);
                              onMobileClose?.();
                            }}
                            title={collapsed ? item.label : undefined}
                            className={`focus-ring group flex min-h-10 flex-1 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-all ${
                              active
                                ? "bg-indigo-50/80 text-indigo-700 font-semibold ring-1 ring-indigo-500/10 shadow-2xs"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            } ${collapsed ? "justify-center" : ""}`}
                          >
                            <Icon size={18} strokeWidth={active ? 2.2 : 1.75} className={active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-700"} />
                            {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                          </Link>
                          {!collapsed && filteredChildren.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedMenu(open ? "__closed" : item.moduleKey)}
                              className="focus-ring absolute right-1.5 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 cursor-pointer"
                              aria-label={`${open ? "Ocultar" : "Mostrar"} opciones de ${item.label}`}
                              aria-expanded={open}
                            >
                              <ChevronDown size={14} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                            </button>
                          ) : null}
                        </div>
                        {!collapsed && open && filteredChildren.length > 0 ? (
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200/80 pl-3">
                            {filteredChildren.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={onMobileClose}
                                className={`focus-ring block rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                  pathname === child.href ? "font-bold text-indigo-600 bg-indigo-50/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Toggle Collapse */}
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`focus-ring hidden h-10 w-full items-center rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors md:flex cursor-pointer ${collapsed ? "justify-center" : "gap-2.5 px-3"}`}
            aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Colapsar barra</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
