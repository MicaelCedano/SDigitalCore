import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { getUserOperationsOverview } from "@/lib/dashboard/user-operations";
import { AdminWarrantyWidget } from "@/components/dashboard/AdminWarrantyWidget";
import { AdminTechnicianPaymentsWidget } from "@/components/dashboard/AdminTechnicianPaymentsWidget";
import { AdminWorkCenterWidget } from "@/components/dashboard/AdminWorkCenterWidget";
import { UserSalesWidget } from "@/components/dashboard/UserSalesWidget";
import { UserWorkCenterWidget } from "@/components/dashboard/UserWorkCenterWidget";
import { UserWarrantyWidget } from "@/components/dashboard/UserWarrantyWidget";
import { UserWarehouseWidget } from "@/components/dashboard/UserWarehouseWidget";
import { UserQcWidget } from "@/components/dashboard/UserQcWidget";
import { UserTechnicianWidget } from "@/components/dashboard/UserTechnicianWidget";
import { UserWalletWidget } from "@/components/dashboard/UserWalletWidget";
import {
  ArrowRight,
  ClipboardCheck,
  PackageCheck,
  Plus,
  UserPlus,
  AlertCircle,
  Coins,
  ShieldCheck,
  Warehouse,
  ScanSearch,
  FilePlus,
  ExternalLink,
  Calendar,
  Sparkles,
  TrendingUp,
  BriefcaseBusiness,
  FileText,
  Tag,
  Wrench,
  Lock,
  WalletCards,
  ShieldAlert,
} from "lucide-react";

export const metadata: Metadata = { title: "Resumen general" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

export default async function DashboardPage() {
  const [user, persistedUser] = await Promise.all([
    getCurrentUser(),
    getPersistedCurrentUser(),
  ]);

  const isAdmin = persistedUser?.roleCode === "ADMIN";
  const userModules = persistedUser?.allowedModules ?? [];
  const allowedModuleSet = new Set(userModules);

  const [overview, userOverview] = await Promise.all([
    isAdmin && persistedUser ? getAdminOperationsOverview(persistedUser.id) : Promise.resolve(null),
    !isAdmin && persistedUser
      ? getUserOperationsOverview(persistedUser.id, userModules, persistedUser.roleCode)
      : Promise.resolve(null),
  ]);

  const now = new Date();
  const hour = Number(
    now.toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false,
    }),
  );
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] ?? "usuario";
  const dateFormatted = formatLongDate(now);
  const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  // Total acumulado de pagos pendientes para Admin
  const totalPendingPayouts = overview
    ? overview.repairPendingTotal +
      overview.unlockPendingTotal +
      overview.qcSubmittedPendingTotal +
      overview.redemptionsPendingTotal
    : 0;

  const totalPendingCount = overview
    ? overview.repairPendingCount +
      overview.unlockPendingCount +
      overview.qcSubmittedCount +
      overview.redemptionsPendingCount
    : 0;

  // Verificamos si el usuario no-admin tiene algún módulo activo visible
  const hasSalesModule = allowedModuleSet.has("facturas") || allowedModuleSet.has("precios") || persistedUser?.roleCode === "VENTAS";
  const hasWorkCenterModule = allowedModuleSet.has("centro-trabajo");
  const hasWarrantyModule = allowedModuleSet.has("garantias");
  const hasWarehouseModule = allowedModuleSet.has("almacen") || persistedUser?.roleCode === "ALMACEN";
  const hasQcModule = allowedModuleSet.has("qc") || persistedUser?.roleCode === "QC";
  const hasTechnicianModule =
    allowedModuleSet.has("reparaciones") ||
    allowedModuleSet.has("desbloqueos") ||
    persistedUser?.roleCode === "TECNICO";
  const hasWalletModule = allowedModuleSet.has("wallet") || persistedUser?.roleCode === "TECNICO";

  const hasAnyActiveModule =
    isAdmin ||
    hasSalesModule ||
    hasWorkCenterModule ||
    hasWarrantyModule ||
    hasWarehouseModule ||
    hasQcModule ||
    hasTechnicianModule ||
    hasWalletModule;

  return (
    <div className="mx-auto max-w-[1360px] space-y-6">
      {/* 1. Header principal con estado en vivo y botones de acción rápida dinámicos */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <span>{capitalizedDate}</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-900 sm:text-3xl">
            {greeting}, {firstName}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {isAdmin
              ? "Control de operaciones, tareas del equipo, pagos a técnicos y trazabilidad en tiempo real."
              : "Tu espacio de trabajo operativo y accesos a tus herramientas activas."}
          </p>
        </div>

        {/* Acciones Rápidas Dinámicas */}
        {isAdmin && overview ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/centro-trabajo"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-violet-600/20 transition-all hover:bg-violet-700 active:scale-[0.98]"
            >
              <BriefcaseBusiness size={15} /> Centro de trabajo
            </Link>
            <Link
              href="/qc/lotes"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <Plus size={15} /> Nueva compra (QC)
            </Link>
            <Link
              href="/garantias/ingreso"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <FilePlus size={15} /> Nueva garantía
            </Link>
            <Link
              href="/almacen/transferencias"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <Warehouse size={15} /> Solicitud almacén
            </Link>
          </div>
        ) : !isAdmin && userOverview ? (
          <div className="flex flex-wrap items-center gap-2">
            {hasSalesModule && (
              <Link
                href="/facturas"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.98]"
              >
                <Plus size={15} /> Nueva Factura
              </Link>
            )}
            {allowedModuleSet.has("precios") && (
              <Link
                href="/precios"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <Tag size={15} /> Lista de Precios
              </Link>
            )}
            {hasWorkCenterModule && (
              <Link
                href="/centro-trabajo"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-violet-600/20 transition-all hover:bg-violet-700 active:scale-[0.98]"
              >
                <BriefcaseBusiness size={15} /> Mis Tareas
              </Link>
            )}
            {hasWarrantyModule && (
              <Link
                href="/garantias/ingreso"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <FilePlus size={15} /> Ingresar Garantía
              </Link>
            )}
            {hasWarehouseModule && (
              <Link
                href="/almacen/transferencias"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <Warehouse size={15} /> Solicitud Almacén
              </Link>
            )}
            {hasQcModule && (
              <Link
                href="/qc"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <ScanSearch size={15} /> Panel QC
              </Link>
            )}
            {hasWalletModule && (
              <Link
                href="/wallet"
                className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <WalletCards size={15} /> Mi Wallet
              </Link>
            )}
          </div>
        ) : null}
      </section>

      {/* ========================================================= */}
      {/* VISTA 1: ADMINISTRADOR */}
      {/* ========================================================= */}
      {isAdmin && overview ? (
        <>
          {/* Barra de KPIs Operativos Clave Admin */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Indicadores clave">
            {/* KPI 1: Pagos a técnicos y personal */}
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/10">
                  <Coins size={18} strokeWidth={2.2} />
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${totalPendingCount > 0 ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"}`}>
                  {totalPendingCount > 0 ? `${totalPendingCount} pendiente${totalPendingCount === 1 ? "" : "s"}` : "Al día"}
                </span>
              </div>
              <div className="mt-3.5">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  RD$ {totalPendingPayouts.toLocaleString("es-DO")}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Pagos por autorizar</p>
              </div>
            </div>

            {/* KPI 2: Casos activos garantías */}
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10">
                  <ShieldCheck size={18} strokeWidth={2.2} />
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {overview.warrantyCounts["RECEIVED_FROM_TECHNICIAN"] ?? 0} listos
                </span>
              </div>
              <div className="mt-3.5">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {overview.warrantyCounts.totalActive ?? 0}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Casos activos garantías</p>
              </div>
            </div>

            {/* KPI 3: Equipos en Taller */}
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-500/10">
                  <ClipboardCheck size={18} strokeWidth={2.2} />
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200/60">
                  {overview.repairPendingCount} por aprobar
                </span>
              </div>
              <div className="mt-3.5">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {overview.repairPendingCount}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Equipos en taller</p>
              </div>
            </div>

            {/* KPI 4: Desbloqueos */}
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/10">
                  <ScanSearch size={18} strokeWidth={2.2} />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200/60">
                  {overview.unlockPendingCount} por revisar
                </span>
              </div>
              <div className="mt-3.5">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {overview.unlockPendingCount}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Desbloqueos</p>
              </div>
            </div>

            {/* KPI 5: Solicitudes Almacén */}
            <div className="group col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-md sm:col-span-1">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10">
                  <Warehouse size={18} strokeWidth={2.2} />
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${overview.pendingWarehouseRequestCount > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"}`}>
                  {overview.pendingWarehouseRequestCount > 0 ? `${overview.pendingWarehouseRequestCount} pend.` : "Al día"}
                </span>
              </div>
              <div className="mt-3.5">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {overview.pendingWarehouseRequestCount}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Solicitudes almacén</p>
              </div>
            </div>
          </section>

          {/* Alerta inteligente con gradiente */}
          {totalPendingCount > 0 ? (
            <div className="flex flex-col gap-3.5 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/70 via-orange-50/30 to-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-4.5">
              <div className="flex items-start gap-3 sm:items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-700">
                  <AlertCircle size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Atención: Tienes {totalPendingCount} pago{totalPendingCount === 1 ? "" : "s"} y lote{totalPendingCount === 1 ? "" : "s"} listos para autorización
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    Monto total acumulado: <strong>RD$ {totalPendingPayouts.toLocaleString("es-DO")}</strong>. Puedes aprobarlos directamente abajo en 1 clic.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Grilla principal 1: Estaciones de Trabajo (2 columnas en xl) */}
          <section className="grid gap-6 xl:grid-cols-2" aria-label="Estaciones de trabajo operativas">
            {/* Widget 1: Centro de Aprobaciones y Pagos Inmediatos */}
            <AdminTechnicianPaymentsWidget
              repairJobs={overview.repairJobsPending}
              unlockRequests={overview.unlockRequestsPending}
              qcBatches={overview.qcBatchesPending}
              walletRedemptions={overview.walletRedemptionsPending}
              repairPendingTotal={overview.repairPendingTotal}
              unlockPendingTotal={overview.unlockPendingTotal}
              qcSubmittedPendingTotal={overview.qcSubmittedPendingTotal}
              redemptionsPendingTotal={overview.redemptionsPendingTotal}
            />

            {/* Widget 2: Centro de Trabajo Operativo en Vivo */}
            <AdminWorkCenterWidget data={overview.workCenter} />
          </section>

          {/* Grilla principal 2: Garantías y Logística (2 columnas en xl) */}
          <section className="grid gap-6 xl:grid-cols-2" aria-label="Garantías y Logística">
            {/* Widget 3: Garantías y Trazabilidad en Vivo */}
            <AdminWarrantyWidget
              cases={overview.recentWarrantyCases}
              events={overview.recentWarrantyEvents}
              counts={overview.warrantyCounts}
            />

            {/* Columna Derecha: Solicitudes de Almacén + Recibo + Solicitudes de Acceso */}
            <div className="space-y-6">
              {/* Solicitudes de Almacén */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden transition-all">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10">
                      <ClipboardCheck size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">Solicitudes de Almacén</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${overview.pendingWarehouseRequestCount > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"}`}>
                          {overview.pendingWarehouseRequestCount} pendiente{overview.pendingWarehouseRequestCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Entradas, salidas y transferencias pendientes de autorización.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/almacen/transferencias"
                    className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:border-slate-300"
                  >
                    Ver almacén <ExternalLink size={12} />
                  </Link>
                </div>

                {overview.pendingWarehouseRequests.length > 0 ? (
                  <div className="divide-y divide-slate-100 p-2 sm:p-3">
                    {overview.pendingWarehouseRequests.map((request) => (
                      <Link
                        key={request.id}
                        href="/almacen/transferencias"
                        className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                              {request.requestCode}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.type === "ENTRY" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60"}`}>
                              {request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}
                            </span>
                            <span className="text-[11px] text-slate-400">· {formatDate(request.createdAt)}</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{request.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Por: <span className="font-medium text-slate-700">{request.requestedBy}</span> · Sucursal: <span className="font-medium text-slate-700">{request.branch}</span> · {request._count.items} línea{request._count.items === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-800">
                          Revisar <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-9 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                      <PackageCheck size={20} />
                    </div>
                    <p className="mt-2.5 text-sm font-semibold text-slate-900">No hay solicitudes pendientes</p>
                    <p className="mt-0.5 text-xs text-slate-500">Todas las solicitudes de almacén están procesadas.</p>
                  </div>
                )}

                <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-right sm:px-6 rounded-b-2xl">
                  <Link href="/almacen/transferencias" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                    Ir a transferencias y solicitudes <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Último Recibo */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden transition-all">
                <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10">
                      <PackageCheck size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Último Recibo de Mercancía</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Registro de ingreso de productos más reciente.</p>
                    </div>
                  </div>
                </div>

                {overview.latestReceipt ? (
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">{overview.latestReceipt.receiptNumber}</span>
                        <h4 className="mt-1 text-base font-bold text-slate-900">{overview.latestReceipt.supplierName}</h4>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Sucursal: <span className="font-medium text-slate-700">{overview.latestReceipt.branch}</span> · Recibido por: <span className="font-medium text-slate-700">{overview.latestReceipt.receivedBy}</span>
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                        {overview.latestReceipt.status === "DRAFT" ? "BORRADOR" : "COMPLETADO"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                        <p className="font-mono text-xl font-bold text-slate-900">{overview.latestReceipt.itemCount}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">modelos / líneas</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                        <p className="font-mono text-xl font-bold text-slate-900">{overview.latestReceipt.unitCount}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">unidades totales</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500">{formatDate(overview.latestReceipt.receivedAt)}</span>
                      <Link
                        href="/almacen/recibos"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        Abrir recibos de almacén <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-slate-500">
                    Todavía no hay recibos de mercancía registrados.
                  </div>
                )}
              </div>

              {/* Solicitudes de Acceso de Usuarios */}
              <Link
                href="/configuracion"
                className="group flex items-center justify-between gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10">
                    <UserPlus size={19} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Solicitudes de Acceso al Sistema</h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {overview.pendingAccessRequestCount > 0
                        ? `${overview.pendingAccessRequestCount} usuario(s) esperando aprobación de cuenta`
                        : "No hay solicitudes de nuevos usuarios pendientes"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {overview.pendingAccessRequestCount > 0 && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200/60">
                      {overview.pendingAccessRequestCount}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </div>
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {/* ========================================================= */}
      {/* VISTA 2: USUARIOS NO-ADMINISTRADORES (MODULAR & DINÁMICA) */}
      {/* ========================================================= */}
      {!isAdmin && userOverview ? (
        <>
          {/* Fila de Indicadores Personalizados según Módulos Activos */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Indicadores personales">
            {userOverview.sales && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10">
                    <FileText size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    Hoy
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                    {userOverview.sales.invoicesCountToday}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Facturas / conduces hoy</p>
                </div>
              </div>
            )}

            {userOverview.workCenter && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-500/10">
                    <BriefcaseBusiness size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                    {userOverview.workCenter.inProgressCount} en curso
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                    {userOverview.workCenter.totalPending}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Mis tareas pendientes</p>
                </div>
              </div>
            )}

            {userOverview.warranties && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10">
                    <ShieldCheck size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    {userOverview.warranties.readyForDispatchCount} listos
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                    {userOverview.warranties.totalActive}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Garantías activas</p>
                </div>
              </div>
            )}

            {userOverview.qc && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-purple-500/10">
                    <ScanSearch size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                    {userOverview.qc.inspectedTodayCount} hoy
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                    {userOverview.qc.assignedPendingCount}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Equipos por revisar (QC)</p>
                </div>
              </div>
            )}

            {userOverview.warehouse && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/10">
                    <Warehouse size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {userOverview.warehouse.pendingRequestsCount} pend.
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                    {userOverview.warehouse.totalProductsCount}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Productos en almacén</p>
                </div>
              </div>
            )}

            {userOverview.wallet && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/10">
                    <WalletCards size={18} strokeWidth={2.2} />
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">
                    Disponible
                  </span>
                </div>
                <div className="mt-3.5">
                  <p className="font-mono text-2xl font-bold tracking-tight text-teal-700">
                    RD$ {userOverview.wallet.balance.toLocaleString("es-DO")}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Balance en Mi Wallet</p>
                </div>
              </div>
            )}
          </section>

          {/* Renderizado Modular de Widgets según Permisos */}
          <section className="space-y-8">
            {/* Widget 1: Ventas y Lista de Precios */}
            {userOverview.sales && hasSalesModule && (
              <UserSalesWidget data={userOverview.sales} />
            )}

            {/* Widget 2: Centro de Trabajo */}
            {userOverview.workCenter && hasWorkCenterModule && (
              <UserWorkCenterWidget data={userOverview.workCenter} />
            )}

            {/* Widget 3: Garantías */}
            {userOverview.warranties && hasWarrantyModule && (
              <UserWarrantyWidget data={userOverview.warranties} />
            )}

            {/* Widget 4: Almacén */}
            {userOverview.warehouse && hasWarehouseModule && (
              <UserWarehouseWidget data={userOverview.warehouse} />
            )}

            {/* Widget 5: Control de Calidad */}
            {userOverview.qc && hasQcModule && (
              <UserQcWidget data={userOverview.qc} />
            )}

            {/* Widget 6: Taller / Reparaciones y Desbloqueos */}
            {(userOverview.repairs || userOverview.unlocks) && hasTechnicianModule && (
              <UserTechnicianWidget
                repairsData={userOverview.repairs}
                unlocksData={userOverview.unlocks}
              />
            )}

            {/* Widget 7: Mi Wallet */}
            {userOverview.wallet && hasWalletModule && (
              <UserWalletWidget data={userOverview.wallet} />
            )}
          </section>
        </>
      ) : null}

      {/* ========================================================= */}
      {/* ESTADO VACÍO: USUARIO SIN MÓDULOS ACTIVOS */}
      {/* ========================================================= */}
      {!hasAnyActiveModule && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10">
            <ShieldAlert size={24} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Sin módulos asignados
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Tu cuenta aún no tiene módulos operativos activos asignados. Comunícate con un administrador del sistema para habilitar tus permisos de trabajo.
          </p>
        </div>
      )}
    </div>
  );
}
