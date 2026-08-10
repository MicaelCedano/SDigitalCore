"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, ChevronDown, Clock3, LogOut, Menu, Settings, User } from "lucide-react";
import { GlobalImeiSearch } from "@/components/layout/GlobalImeiSearch";

export interface TopbarNotification {
  id: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  kind: "action" | "activity";
}

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  userAvatarUrl?: string | null;
  notifications?: TopbarNotification[];
  notificationCount?: number;
  onMobileToggle?: () => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Resumen general",
  "/inventario": "Inventario y equipos",
  "/almacen": "Almacén y solicitudes",
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

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function Topbar({ userName, userEmail, userRole, userAvatarUrl, notifications = [], notificationCount = 0, onMobileToggle }: TopbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadedNotifications, setLoadedNotifications] = useState<TopbarNotification[] | null>(null);
  const [loadedNotificationCount, setLoadedNotificationCount] = useState<number | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setDropdownOpen(false);
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const visibleNotifications = loadedNotifications ?? notifications;
  const visibleNotificationCount = loadedNotificationCount ?? notificationCount;

  async function openNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    setDropdownOpen(false);
    if (!nextOpen || loadedNotifications !== null || notificationsLoading) return;

    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/dashboard/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar las notificaciones.");
      const data = (await response.json()) as {
        notifications: TopbarNotification[];
        notificationCount: number;
      };
      setLoadedNotifications(data.notifications);
      setLoadedNotificationCount(data.notificationCount);
    } catch {
      setLoadedNotifications([]);
      setLoadedNotificationCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-[#e4e7ec] bg-white px-4 sm:px-6 lg:px-8 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMobileToggle} className="focus-ring -ml-1 rounded-lg p-2 text-[#475467] hover:bg-[#f2f4f7] md:hidden" aria-label="Abrir navegación">
          <Menu size={21} />
        </button>
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#101828] sm:text-xl">{getPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <GlobalImeiSearch />
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => void openNotifications()}
            className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#475467] hover:bg-[#f2f4f7]"
            aria-label={visibleNotificationCount > 0 ? `Notificaciones, ${visibleNotificationCount} pendientes` : "Notificaciones"}
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
          >
            <Bell size={20} strokeWidth={1.75} />
            {visibleNotificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#d92d20] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {visibleNotificationCount > 99 ? "99+" : visibleNotificationCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div role="dialog" aria-label="Centro de notificaciones" className="animate-fade-in absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-[0_18px_44px_-12px_rgba(16,24,40,.24)]">
              <div className="flex items-center justify-between border-b border-[#f0f1f3] px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">Notificaciones</p>
                  <p className="mt-0.5 text-xs text-[#667085]">Actividad y acciones que requieren atención.</p>
                </div>
                {visibleNotificationCount > 0 ? <span className="rounded-full bg-[#fef3f2] px-2 py-1 text-xs font-semibold text-[#b42318]">{visibleNotificationCount} pendientes</span> : null}
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2">
                {notificationsLoading ? (
                  <div className="px-4 py-9 text-center text-sm text-[#667085]">Cargando notificaciones…</div>
                ) : visibleNotifications.length > 0 ? visibleNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    onClick={() => setNotificationsOpen(false)}
                    className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[#f8fafc]"
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.kind === "action" ? "bg-[#fff4e5] text-[#b54708]" : "bg-[#ecfdf3] text-[#027a48]"}`}>
                      {notification.kind === "action" ? <Clock3 size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#344054] group-hover:text-[#4338ca]">{notification.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#667085]">{notification.description}</span>
                      <span className="mt-1 block text-[11px] font-medium text-[#98a2b3]">{formatNotificationDate(notification.createdAt)}</span>
                    </span>
                  </Link>
                )) : (
                  <div className="px-4 py-9 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]"><CheckCircle2 size={20} /></span>
                    <p className="mt-3 text-sm font-semibold text-[#344054]">Todo está al día</p>
                    <p className="mt-1 text-xs text-[#667085]">No hay acciones pendientes.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden h-7 w-px bg-[#e4e7ec] sm:block" />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="focus-ring flex items-center gap-2 rounded-[10px] p-1 pr-1.5 text-left hover:bg-[#f8fafc]"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2ff] text-xs font-bold text-[#4338ca]">
              {userAvatarUrl ? <Image src={userAvatarUrl} alt="" fill className="object-cover" /> : getInitials(userName)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-36 truncate text-[13px] font-semibold text-[#101828]">{userName ?? "Usuario"}</span>
              <span className="block text-[11px] capitalize text-[#667085]">{userRole?.toLowerCase() ?? "Administrador"}</span>
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
