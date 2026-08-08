"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Settings, User } from "lucide-react";
import { getUsers } from "@/lib/auth/roles-permissions";

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
  onMobileToggle?: () => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Resumen general",
  "/inventario": "Inventario y equipos",
  "/almacen": "Almacén y transferencias",
  "/ventas": "Ventas y facturación",
  "/taller": "Taller y reparaciones",
  "/rma": "RMA y garantías",
  "/qc": "Control de calidad",
  "/clientes": "Clientes",
  "/proveedores": "Proveedores",
  "/precios": "Lista de precios",
  "/facturas": "Facturas y comprobantes",
  "/reportes": "Reportes",
  "/configuracion": "Configuración",
  "/perfil": "Mi perfil",
};

function getPageTitle(pathname: string) {
  return Object.entries(pageTitles).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "SDigitalCore";
}

function getInitials(name?: string | null) {
  return name?.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

export function Topbar({ userName, userEmail, onMobileToggle }: TopbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentUser = getUsers().find((user) => user.email === userEmail || user.name === userName);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-[#e4e7ec] bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMobileToggle} className="focus-ring -ml-1 rounded-lg p-2 text-[#475467] hover:bg-[#f2f4f7] md:hidden" aria-label="Abrir navegación">
          <Menu size={21} />
        </button>
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#101828] sm:text-xl">{getPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button type="button" className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#475467] hover:bg-[#f2f4f7]" aria-label="Notificaciones">
          <Bell size={20} strokeWidth={1.75} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#4f46e5] ring-2 ring-white" />
        </button>

        <div className="hidden h-7 w-px bg-[#e4e7ec] sm:block" />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((open) => !open)}
            className="focus-ring flex items-center gap-2 rounded-[10px] p-1 pr-1.5 text-left hover:bg-[#f8fafc]"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2ff] text-xs font-bold text-[#4338ca]">
              {currentUser?.avatarUrl ? <Image src={currentUser.avatarUrl} alt="" fill className="object-cover" /> : getInitials(userName)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-36 truncate text-[13px] font-semibold text-[#101828]">{userName ?? "Usuario"}</span>
              <span className="block text-[11px] capitalize text-[#667085]">{currentUser?.roleCode?.toLowerCase() ?? "Administrador"}</span>
            </span>
            <ChevronDown size={15} className={`hidden text-[#98a2b3] transition-transform sm:block ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen ? (
            <div role="menu" className="animate-fade-in absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white p-2 shadow-[0_16px_36px_-12px_rgba(16,24,40,.22)]">
              <div className="border-b border-[#f0f1f3] px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-[#101828]">{userName ?? "Usuario"}</p>
                <p className="truncate text-xs text-[#667085]">{userEmail ?? ""}</p>
              </div>
              <div className="py-1">
                <Link href="/perfil" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#344054] hover:bg-[#f8fafc]" role="menuitem">
                  <User size={17} /><span>Mi perfil</span>
                </Link>
                <Link href="/configuracion" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#344054] hover:bg-[#f8fafc]" role="menuitem">
                  <Settings size={17} /><span>Configuración</span>
                </Link>
              </div>
              <div className="border-t border-[#f0f1f3] pt-1">
                <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#d92d20] hover:bg-[#fef3f2]" role="menuitem">
                  <LogOut size={17} /><span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
