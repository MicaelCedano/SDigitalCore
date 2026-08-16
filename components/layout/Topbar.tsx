"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, ChevronDown, Clock3, LogOut, Menu, Settings, User, Wallet, Sparkles } from "lucide-react";
import { GlobalImeiSearch } from "@/components/layout/GlobalImeiSearch";
import { UserAvatar } from "@/components/shared/UserAvatar";

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
  walletBalance?: string | null;
  notifications?: TopbarNotification[];
  notificationCount?: number;
  onMobileToggle?: () => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Resumen general",
  "/almacen": "Almacén y solicitudes",
  "/garantias": "Gestión de Garantías",
  "/precios": "Lista de precios",
  "/facturas": "Facturas y comprobantes",
  "/inventario": "Inventario y equipos",
  "/ventas": "Ventas y facturación",
  "/taller": "Taller y reparaciones",
  "/rma": "Gestión de Garantías",
  "/qc": "Control de calidad",
  "/clientes": "Clientes",
  "/proveedores": "Proveedores",
  "/reportes": "Reportes",
  "/configuracion": "Configuración",
  "/perfil": "Mi perfil",
};

function getPageTitle(pathname: string) {
  const match = Object.entries(pageTitles).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] ?? "SDigitalCore";
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

export function Topbar({
  userName,
  userEmail,
  userRole,
  userAvatarUrl,
  walletBalance,
  notifications = [],
  notificationCount = 0,
  onMobileToggle,
}: TopbarProps) {
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

  useEffect(() => {
    setLoadedNotifications(null);
    setLoadedNotificationCount(null);
  }, [pathname]);

  const visibleNotifications = loadedNotifications ?? notifications;
  const visibleNotificationCount = loadedNotificationCount ?? notificationCount;

  async function openNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    setDropdownOpen(false);
    if (!nextOpen) return;

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
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 print:hidden transition-all">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMobileToggle}
          className="focus-ring -ml-1 rounded-xl p-2 text-slate-500 hover:bg-slate-100/70 hover:text-slate-900 md:hidden cursor-pointer"
          aria-label="Abrir navegación"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            {getPageTitle(pathname)}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* IMEI Global Search */}
        <GlobalImeiSearch />

        {/* Notifications Popover */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => void openNotifications()}
            className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label={visibleNotificationCount > 0 ? `Notificaciones, ${visibleNotificationCount} pendientes` : "Notificaciones"}
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
          >
            <Bell size={18} strokeWidth={2} />
            {visibleNotificationCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {visibleNotificationCount > 99 ? "99+" : visibleNotificationCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div
              role="dialog"
              aria-label="Centro de notificaciones"
              className="animate-fade-in absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_44px_-12px_rgba(16,24,40,.20)] z-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-slate-900">Notificaciones</p>
                  <p className="mt-0.5 text-xs text-slate-500">Actividad y alertas prioritarias.</p>
                </div>
                {visibleNotificationCount > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200/60">
                    {visibleNotificationCount} pendientes
                  </span>
                ) : null}
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2">
                {notificationsLoading ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-500">Cargando notificaciones…</div>
                ) : visibleNotifications.length > 0 ? (
                  visibleNotifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.href}
                      onClick={() => {
                        setNotificationsOpen(false);
                        setLoadedNotifications(null);
                        setLoadedNotificationCount(null);
                      }}
                      className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          notification.kind === "action" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {notification.kind === "action" ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-4 text-slate-500">{notification.description}</span>
                        <span className="mt-1 block text-[10px] font-medium text-slate-400">
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                      <CheckCircle2 size={18} />
                    </span>
                    <p className="mt-2.5 text-xs font-bold text-slate-800">Todo está al día</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">No hay acciones pendientes.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />

        {/* User profile & Wallet pill */}
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          {walletBalance !== null && walletBalance !== undefined ? (
            <Link
              href="/wallet"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 text-xs font-bold text-indigo-700 shadow-2xs transition-all hover:bg-indigo-100/70 hover:border-indigo-200"
              title="Ver Mi Wallet"
            >
              <Wallet size={14} strokeWidth={2.2} className="text-indigo-600" />
              <span className="font-mono">
                RD$ {Number(walletBalance).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setDropdownOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="focus-ring flex items-center gap-2 rounded-xl p-1 pr-2 text-left hover:bg-slate-100/60 transition-colors cursor-pointer"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <UserAvatar name={userName} email={userEmail} src={userAvatarUrl} className="h-9 w-9 bg-indigo-100 text-indigo-700 font-bold" />
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-32 truncate text-xs font-bold text-slate-900">{userName ?? "Usuario"}</span>
              <span className="block text-[10px] capitalize text-slate-500">{userRole?.toLowerCase() ?? "Administrador"}</span>
            </span>
            <ChevronDown size={14} className={`hidden text-slate-400 transition-transform sm:block ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen ? (
            <div
              role="menu"
              className="animate-fade-in absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_16px_36px_-12px_rgba(16,24,40,.20)] z-50"
            >
              <div className="border-b border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2.5 mb-1">
                <p className="truncate text-xs font-bold text-slate-900">{userName ?? "Usuario"}</p>
                <p className="truncate text-[11px] text-slate-500">{userEmail ?? ""}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/perfil"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  role="menuitem"
                >
                  <User size={15} className="text-slate-400" />
                  <span>Mi perfil</span>
                </Link>
                <Link
                  href="/configuracion"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  role="menuitem"
                >
                  <Settings size={15} className="text-slate-400" />
                  <span>Configuración</span>
                </Link>
              </div>
              <div className="border-t border-slate-100 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <LogOut size={15} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
