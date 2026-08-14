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
} from "lucide-react";

interface SubNavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  moduleKey: string;
  icon: React.ElementType;
  section: "Inicio" | "Operaciones" | "Comercial" | "Administración";
  children?: SubNavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", moduleKey: "dashboard", icon: LayoutDashboard, section: "Inicio" },
  { label: "Centro de trabajo", href: "/centro-trabajo", moduleKey: "work-center", icon: BriefcaseBusiness, section: "Inicio" },
  { label: "Almacén", href: "/almacen", moduleKey: "almacen", icon: Warehouse, section: "Operaciones", children: [
    { label: "Productos", href: "/almacen" },
    { label: "Recibo de mercancía", href: "/almacen/recibos" },
    { label: "Movimientos", href: "/almacen/movimientos", adminOnly: true },
    { label: "Solicitudes de almacén", href: "/almacen/transferencias" },
  ] },
  { label: "Control de Calidad", href: "/qc", moduleKey: "qc", icon: ScanSearch, section: "Operaciones", children: [
    { label: "Panel QC", href: "/qc" },
    { label: "Compra de lotes", href: "/qc/lotes", adminOnly: true },
    { label: "Pagos QC", href: "/qc/pagos", adminOnly: true },
    { label: "Penalidades", href: "/qc/penalidades", adminOnly: true },
    { label: "Solicitudes de IMEIs", href: "/qc/solicitudes", adminOnly: true },
    { label: "Equipos revisados", href: "/qc/equipos-revisados", adminOnly: true },
  ] },
  { label: "Reparaciones", href: "/reparaciones", moduleKey: "reparaciones", icon: Wrench, section: "Operaciones", children: [
    { label: "Panel de reparaciones", href: "/reparaciones" },
    { label: "Aprobar pagos", href: "/reparaciones/pagos", adminOnly: true },
  ] },
  { label: "Desbloqueos", href: "/desbloqueos", moduleKey: "desbloqueos", icon: Lock, section: "Operaciones", children: [
    { label: "Panel de desbloqueos", href: "/desbloqueos" },
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
    { label: "Sucursales", href: "/configuracion/sucursales" },
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
    item.moduleKey === "dashboard" || item.moduleKey === "work-center" || allowedModuleSet === null || allowedModuleSet.has(item.moduleKey),
  );
  const sections = ["Inicio", "Operaciones", "Comercial", "Administración"] as const;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-[#101828]/45 backdrop-blur-[2px] md:hidden"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-[#e4e7ec] bg-white transition-[width,transform] duration-200 print:hidden md:relative md:translate-x-0 ${
          collapsed ? "w-[76px]" : "w-[276px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-[72px] items-center border-b border-[#f0f1f3] ${collapsed ? "justify-center px-3" : "justify-between px-5"}`}>
          <Link href="/dashboard" className="focus-ring flex min-w-0 items-center gap-3 rounded-lg" onClick={onMobileClose}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e4e7ec] bg-white">
              <Image src="/logo.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" priority unoptimized />
            </span>
            {!collapsed ? <span className="truncate text-[17px] font-bold tracking-[-0.025em] text-[#101828]">SDigitalCore</span> : null}
          </Link>
          {!collapsed ? (
            <button type="button" onClick={onMobileClose} className="focus-ring rounded-lg p-2 text-[#667085] hover:bg-[#f2f4f7] md:hidden" aria-label="Cerrar menú">
              <X size={19} />
            </button>
          ) : null}
        </div>

        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => {
            const items = visibleItems.filter((item) => item.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="mb-5 last:mb-0">
                {!collapsed ? <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{section}</p> : null}
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === "/almacen" && pathname.startsWith("/almacen/recibos") ? false : isActive(item.href);
                    const open = expandedMenu === item.moduleKey || (expandedMenu === null && active);
                    return (
                      <div key={item.href}>
                        <div className="relative flex items-center">
                          <Link
                            href={item.href}
                            onClick={() => {
                              if (item.children?.length) setExpandedMenu(item.moduleKey);
                              onMobileClose?.();
                            }}
                            title={collapsed ? item.label : undefined}
                            className={`focus-ring group flex min-h-11 flex-1 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors ${
                              active ? "bg-[#eef2ff] text-[#4338ca]" : "text-[#344054] hover:bg-[#f8fafc] hover:text-[#101828]"
                            } ${collapsed ? "justify-center" : ""}`}
                          >
                            <Icon size={19} strokeWidth={1.75} className={active ? "text-[#4f46e5]" : "text-[#667085] group-hover:text-[#344054]"} />
                            {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                          </Link>
                          {!collapsed && item.children?.length ? (
                            <button
                              type="button"
                              onClick={() => setExpandedMenu(open ? "__closed" : item.moduleKey)}
                              className="focus-ring absolute right-1.5 rounded-md p-2 text-[#98a2b3] hover:text-[#344054]"
                              aria-label={`${open ? "Ocultar" : "Mostrar"} opciones de ${item.label}`}
                              aria-expanded={open}
                            >
                              <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                          ) : null}
                        </div>
                        {!collapsed && open && item.children?.length ? (
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-[#e4e7ec] pl-4">
                            {item.children.filter((child) => child.href !== "/almacen/recibos" && (!child.adminOnly || roleCode === "ADMIN")).map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={onMobileClose}
                                className={`focus-ring block rounded-lg px-3 py-2 text-[13px] transition-colors ${
                                  pathname === child.href ? "font-semibold text-[#4338ca]" : "text-[#667085] hover:bg-[#f8fafc] hover:text-[#344054]"
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

        <div className="border-t border-[#e4e7ec] p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`focus-ring hidden h-11 w-full items-center rounded-[10px] text-sm font-medium text-[#475467] hover:bg-[#f8fafc] md:flex ${collapsed ? "justify-center" : "gap-3 px-3"}`}
            aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
          >
            {collapsed ? <ChevronRight size={19} /> : <><ChevronLeft size={19} /><span>Colapsar</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
