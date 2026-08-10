import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/helpers";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { prisma } from "@/lib/db/prisma";
import {
  ArrowRight,
  BellRing,
  Boxes,
  ClipboardCheck,
  FileText,
  PackageCheck,
  Plus,
  Settings,
  Tag,
  UserPlus,
  Users,
  Warehouse,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = { title: "Resumen general" };

const operations = [
  { label: "GestiÃ³n de GarantÃ­as", href: "/garantias", moduleKey: "garantias", icon: ShieldCheck },
  { label: "Almacén", href: "/almacen", moduleKey: "almacen", icon: Warehouse },
];

const commercial = [
  { label: "Lista de precios", href: "/precios", moduleKey: "precios", icon: Tag },
  { label: "Facturas", href: "/facturas", moduleKey: "facturas", icon: FileText },
];

const administration = [
  { label: "Configuración", href: "/configuracion", moduleKey: "configuracion", icon: Settings },
];

const groups = [
  {
    title: "Operaciones",
    description: "Mercancía, movimientos y solicitudes persistidas.",
    icon: Warehouse,
    items: operations,
  },
  {
    title: "Comercial",
    description: "Precios y documentos comerciales conectados a la base central.",
    icon: FileText,
    items: commercial,
  },
  {
    title: "Administración",
    description: "Información consolidada y control del sistema.",
    icon: Settings,
    items: administration,
  },
];

const adminShortcuts = [
  { label: "Nuevo recibo", description: "Registrar mercancía recibida", href: "/almacen/recibos", icon: Plus },
  { label: "Solicitudes", description: "Aprobar entradas y salidas", href: "/almacen/transferencias", icon: ClipboardCheck },
  { label: "Inventario", description: "Consultar existencias actuales", href: "/almacen", icon: Boxes },
  { label: "Usuarios", description: "Accesos, roles y permisos", href: "/configuracion", icon: Users },
];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const persistedUser = user
    ? await prisma.user.findFirst({
        where: user.id ? { id: user.id } : { email: user.email ?? "" },
        select: { id: true, roleCode: true, allowedModules: true },
      })
    : null;
  const overview = persistedUser?.roleCode === "ADMIN"
    ? await getAdminOperationsOverview(persistedUser.id)
    : null;
  const allowedModuleSet =
    persistedUser?.roleCode === "ADMIN"
      ? null
      : new Set(persistedUser?.allowedModules ?? []);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => allowedModuleSet === null || allowedModuleSet.has(item.moduleKey),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const hour = Number(
    new Date().toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false,
    }),
  );
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] ?? "usuario";

  return (
    <div className="mx-auto max-w-[1280px] space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-[#101828] sm:text-[34px]">{greeting}, {firstName}</h2>
          <p className="mt-2 text-[15px] text-[#667085] sm:text-base">Aquí tienes lo que requiere atención y la actividad más reciente.</p>
        </div>
        {overview ? (
          <Link href="/almacen/recibos" className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4338ca]">
            <Plus size={17} /> Registrar mercancía
          </Link>
        ) : null}
      </section>

      {overview ? (
        <>
          <section aria-labelledby="admin-actions-title">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h3 id="admin-actions-title" className="text-lg font-semibold tracking-[-0.02em] text-[#101828]">Acciones rápidas</h3>
                <p className="mt-1 text-sm text-[#667085]">Atajos para las tareas administrativas más frecuentes.</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-semibold text-[#4338ca] sm:inline-flex"><BellRing size={14} /> Panel admin</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {adminShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <Link key={shortcut.label} href={shortcut.href} className="enterprise-panel group flex items-center gap-3.5 p-4 transition-all hover:-translate-y-0.5 hover:border-[#c7d2fe] hover:shadow-md">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]"><Icon size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#101828]">{shortcut.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#667085]">{shortcut.description}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]" aria-label="Resumen de operaciones administrativas">
            <div className="enterprise-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fff4e5] text-[#b54708]"><ClipboardCheck size={20} /></span>
                  <div>
                    <h3 className="text-base font-semibold text-[#101828]">Solicitudes de almacén</h3>
                    <p className="mt-0.5 text-xs text-[#667085]">Entradas y salidas pendientes de tu decisión.</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overview.pendingWarehouseRequestCount > 0 ? "bg-[#fff4e5] text-[#b54708]" : "bg-[#ecfdf3] text-[#027a48]"}`}>
                  {overview.pendingWarehouseRequestCount} pendiente{overview.pendingWarehouseRequestCount === 1 ? "" : "s"}
                </span>
              </div>

              {overview.pendingWarehouseRequests.length > 0 ? (
                <div className="divide-y divide-[#f0f1f3]">
                  {overview.pendingWarehouseRequests.map((request) => (
                    <Link key={request.id} href="/almacen/transferencias" className="group grid gap-3 px-5 py-4 transition-colors hover:bg-[#f8fafc] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#4f46e5]">{request.requestCode}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.type === "ENTRY" ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#fef3f2] text-[#b42318]"}`}>{request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-[#344054]">{request.title}</p>
                        <p className="mt-1 text-xs text-[#667085]">{request.requestedBy} · {request.branch} · {request._count.items} producto{request._count.items === 1 ? "" : "s"}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4338ca]">Revisar solicitud <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]"><PackageCheck size={21} /></span>
                  <p className="mt-3 text-sm font-semibold text-[#344054]">No hay solicitudes pendientes</p>
                  <p className="mt-1 text-xs text-[#667085]">Todas las solicitudes de almacén están atendidas.</p>
                </div>
              )}
              <div className="border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 text-right sm:px-6">
                <Link href="/almacen/transferencias" className="text-xs font-semibold text-[#4338ca] hover:text-[#3730a3]">Ver todas las solicitudes</Link>
              </div>
            </div>

            <div className="space-y-5">
              <div className="enterprise-panel overflow-hidden">
                <div className="border-b border-[#e4e7ec] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#ecfdf3] text-[#027a48]"><PackageCheck size={20} /></span>
                    <div>
                      <h3 className="text-base font-semibold text-[#101828]">Último recibo</h3>
                      <p className="mt-0.5 text-xs text-[#667085]">Mercancía registrada recientemente.</p>
                    </div>
                  </div>
                </div>
                {overview.latestReceipt ? (
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#4f46e5]">{overview.latestReceipt.receiptNumber}</p>
                        <p className="mt-1.5 text-base font-semibold text-[#101828]">{overview.latestReceipt.supplierName}</p>
                        <p className="mt-1 text-xs text-[#667085]">{overview.latestReceipt.branch} · recibido por {overview.latestReceipt.receivedBy}</p>
                      </div>
                      <span className="rounded-full bg-[#ecfdf3] px-2 py-1 text-[10px] font-bold text-[#027a48]">{overview.latestReceipt.status === "DRAFT" ? "BORRADOR" : "COMPLETADO"}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xl font-bold text-[#101828]">{overview.latestReceipt.itemCount}</p><p className="mt-0.5 text-xs text-[#667085]">modelos / líneas</p></div>
                      <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xl font-bold text-[#101828]">{overview.latestReceipt.unitCount}</p><p className="mt-0.5 text-xs text-[#667085]">unidades</p></div>
                    </div>
                    <p className="mt-4 text-xs text-[#667085]">{formatDate(overview.latestReceipt.receivedAt)}</p>
                    <Link href="/almacen/recibos" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4338ca] hover:text-[#3730a3]">Abrir recibos <ArrowRight size={15} /></Link>
                  </div>
                ) : (
                  <div className="px-5 py-9 text-center text-sm text-[#667085]">Todavía no hay recibos de mercancía.</div>
                )}
              </div>

              <Link href="/configuracion" className="enterprise-panel group flex items-center gap-3.5 p-4 transition-colors hover:border-[#c7d2fe]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]"><UserPlus size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#101828]">Solicitudes de acceso</span><span className="mt-0.5 block text-xs text-[#667085]">{overview.pendingAccessRequestCount} usuario{overview.pendingAccessRequestCount === 1 ? "" : "s"} esperando aprobación</span></span>
                <ArrowRight size={16} className="text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
              </Link>
            </div>
          </section>
        </>
      ) : null}

      <section className="enterprise-panel overflow-hidden" aria-labelledby="operations-title">
        <div className="border-b border-[#e4e7ec] px-5 py-5 sm:px-6">
          <h3 id="operations-title" className="text-lg font-semibold tracking-[-0.02em] text-[#101828]">Centro de operaciones</h3>
          <p className="mt-1 text-sm text-[#667085]">Accede a los módulos habilitados para tu cuenta.</p>
        </div>

        <div className="divide-y divide-[#e4e7ec]">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.title} className="grid lg:grid-cols-[270px_1fr]">
                <div className="flex gap-4 border-b border-[#e4e7ec] bg-[#fcfcfd] p-5 lg:border-b-0 lg:border-r lg:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]">
                    <GroupIcon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-[#101828]">{group.title}</h4>
                    <p className="mt-1 text-[13px] leading-5 text-[#667085]">{group.description}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2">
                  {group.items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex min-h-[58px] items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#344054] outline-none transition-colors hover:bg-[#f8fafc] hover:text-[#4338ca] focus-visible:bg-[#eef2ff] ${
                          index % 2 === 0 ? "sm:border-r sm:border-[#f0f1f3]" : ""
                        } ${index >= 2 ? "border-t border-[#f0f1f3]" : ""}`}
                      >
                        <Icon size={19} strokeWidth={1.75} className="shrink-0 text-[#475467] group-hover:text-[#4f46e5]" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ArrowRight size={16} className="shrink-0 text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
