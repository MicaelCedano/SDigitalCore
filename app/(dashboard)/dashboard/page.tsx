import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, getPersistedCurrentUser } from "@/lib/auth/helpers";
import { getAdminOperationsOverview } from "@/lib/dashboard/admin-operations";
import { AdminWarrantyWidget } from "@/components/dashboard/AdminWarrantyWidget";
import { AdminTechnicianPaymentsWidget } from "@/components/dashboard/AdminTechnicianPaymentsWidget";
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

  const overview = persistedUser?.roleCode === "ADMIN"
    ? await getAdminOperationsOverview(persistedUser.id)
    : null;

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

  // Total acumulado de pagos pendientes
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

  return (
    <div className="mx-auto max-w-[1360px] space-y-6">
      {/* 1. Cabecera principal con fecha y accesos directos */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#667085]">
            <Calendar size={13} className="text-[#4f46e5]" />
            <span>{capitalizedDate} · Santo Domingo</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#101828] sm:text-3xl">
            {greeting}, {firstName}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085] sm:text-sm">
            Control de operaciones, pagos a personal y actividad en tiempo real.
          </p>
        </div>

        {overview ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/qc/lotes"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[#4f46e5] px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#4338ca]"
            >
              <Plus size={15} /> Nueva compra (QC)
            </Link>
            <Link
              href="/garantias/ingreso"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[#d0d5dd] bg-white px-3.5 text-xs font-semibold text-[#344054] shadow-2xs transition-colors hover:bg-[#f8fafc]"
            >
              <FilePlus size={15} /> Nueva garantía
            </Link>
            <Link
              href="/almacen/transferencias"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[#d0d5dd] bg-white px-3.5 text-xs font-semibold text-[#344054] shadow-2xs transition-colors hover:bg-[#f8fafc]"
            >
              <Warehouse size={15} /> Solicitud almacén
            </Link>
          </div>
        ) : null}
      </section>

      {overview ? (
        <>
          {/* 2. Barra de KPIs Operativos Clave (Cómoda y Ejecutiva) */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores clave">
            {/* KPI 1: Pagos a técnicos y personal */}
            <div className="enterprise-panel relative flex flex-col justify-between overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fef3f2] text-[#d92d20]">
                  <Coins size={16} />
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${totalPendingCount > 0 ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#ecfdf3] text-[#027a48]"}`}>
                  {totalPendingCount > 0 ? `${totalPendingCount} pendiente${totalPendingCount === 1 ? "" : "s"}` : "Al día"}
                </span>
              </div>
              <div className="mt-3">
                <p className="font-mono text-xl font-bold tracking-tight text-[#101828] sm:text-2xl">
                  RD$ {totalPendingPayouts.toLocaleString("es-DO")}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#667085]">Pagos por autorizar</p>
              </div>
            </div>

            {/* KPI 2: Garantías activas */}
            <div className="enterprise-panel relative flex flex-col justify-between overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
                  <ShieldCheck size={16} />
                </span>
                <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-bold text-[#4338ca]">
                  {overview.warrantyCounts.IN_REPAIR ?? 0} en taller
                </span>
              </div>
              <div className="mt-3">
                <p className="font-mono text-xl font-bold tracking-tight text-[#101828] sm:text-2xl">
                  {overview.warrantyCounts.totalActive ?? 0}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#667085]">Garantías en curso</p>
              </div>
            </div>

            {/* KPI 3: Lotes QC */}
            <div className="enterprise-panel relative flex flex-col justify-between overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f3ff] text-[#5925dc]">
                  <ScanSearch size={16} />
                </span>
                <span className="rounded-full bg-[#f4f3ff] px-2 py-0.5 text-[11px] font-bold text-[#5925dc]">
                  {overview.qcPendingTotalDevices} equipos
                </span>
              </div>
              <div className="mt-3">
                <p className="font-mono text-xl font-bold tracking-tight text-[#101828] sm:text-2xl">
                  {overview.qcPendingCount}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#667085]">Lotes QC en proceso</p>
              </div>
            </div>

            {/* KPI 4: Solicitudes Almacén */}
            <div className="enterprise-panel relative flex flex-col justify-between overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff4e5] text-[#b54708]">
                  <Warehouse size={16} />
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overview.pendingWarehouseRequestCount > 0 ? "bg-[#fff4e5] text-[#b54708]" : "bg-[#ecfdf3] text-[#027a48]"}`}>
                  {overview.pendingWarehouseRequestCount > 0 ? `${overview.pendingWarehouseRequestCount} pendientes` : "Al día"}
                </span>
              </div>
              <div className="mt-3">
                <p className="font-mono text-xl font-bold tracking-tight text-[#101828] sm:text-2xl">
                  {overview.pendingWarehouseRequestCount}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#667085]">Solicitudes de almacén</p>
              </div>
            </div>
          </section>

          {/* 3. Alerta inteligente si hay pendientes */}
          {totalPendingCount > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#fecdca] bg-gradient-to-r from-[#fffbfa] to-[#fef3f2] p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-4.5">
              <div className="flex items-start gap-3 sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fee4e2] text-[#d92d20] shadow-2xs">
                  <AlertCircle size={20} strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#b42318]">
                    Atención: Tienes {totalPendingCount} pago{totalPendingCount === 1 ? "" : "s"} y lote{totalPendingCount === 1 ? "" : "s"} pendientes de aprobación
                  </p>
                  <p className="mt-0.5 text-xs text-[#7a271a]">
                    Monto total acumulado a pagar: <strong>RD$ {totalPendingPayouts.toLocaleString("es-DO")}</strong>. Puedes aprobarlos directamente abajo en 1 clic.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* 4. Grilla principal de Estaciones de Trabajo */}
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

            {/* Widget 2: Garantías y Trazabilidad en Vivo */}
            <AdminWarrantyWidget
              cases={overview.recentWarrantyCases}
              events={overview.recentWarrantyEvents}
              counts={overview.warrantyCounts}
            />
          </section>

          {/* 5. Grilla secundaria: Logística y Accesos */}
          <section className="grid gap-6 xl:grid-cols-2" aria-label="Logística y Control de Accesos">
            {/* Solicitudes de Almacén */}
            <div className="enterprise-panel overflow-hidden border-[#eaecf0] shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-gradient-to-r from-white via-[#fcfcfd] to-[#f8f9fc] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fff4e5] text-[#b54708] shadow-xs">
                    <ClipboardCheck size={20} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#101828]">Solicitudes de Almacén</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${overview.pendingWarehouseRequestCount > 0 ? "bg-[#fff4e5] text-[#b54708]" : "bg-[#ecfdf3] text-[#027a48]"}`}>
                        {overview.pendingWarehouseRequestCount} pendiente{overview.pendingWarehouseRequestCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#667085]">
                      Entradas, salidas y transferencias pendientes de autorización.
                    </p>
                  </div>
                </div>

                <Link
                  href="/almacen/transferencias"
                  className="focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] shadow-2xs hover:bg-[#f8fafc]"
                >
                  Ver almacén <ExternalLink size={13} />
                </Link>
              </div>

              {overview.pendingWarehouseRequests.length > 0 ? (
                <div className="divide-y divide-[#f0f1f3]">
                  {overview.pendingWarehouseRequests.map((request) => (
                    <Link
                      key={request.id}
                      href="/almacen/transferencias"
                      className="group grid gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafafa] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#4f46e5]">{request.requestCode}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.type === "ENTRY" ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#fef3f2] text-[#b42318]"}`}>
                            {request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}
                          </span>
                          <span className="text-[11px] text-[#667085]">· {formatDate(request.createdAt)}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-[#344054]">{request.title}</p>
                        <p className="mt-0.5 text-xs text-[#667085]">
                          Por: <span className="font-medium text-[#344054]">{request.requestedBy}</span> · Sucursal: <span className="font-medium text-[#344054]">{request.branch}</span> · {request._count.items} línea{request._count.items === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4338ca]">
                        Revisar <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-9 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]">
                    <PackageCheck size={22} />
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-[#101828]">No hay solicitudes pendientes</p>
                  <p className="mt-0.5 text-xs text-[#667085]">Todas las solicitudes de almacén están procesadas.</p>
                </div>
              )}

              <div className="border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 text-right sm:px-6">
                <Link href="/almacen/transferencias" className="text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca]">
                  Ir a transferencias y solicitudes <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Recibo reciente y solicitudes de acceso */}
            <div className="space-y-6">
              {/* Último Recibo */}
              <div className="enterprise-panel overflow-hidden border-[#eaecf0] shadow-xs">
                <div className="border-b border-[#e4e7ec] bg-gradient-to-r from-white via-[#fcfcfd] to-[#f8f9fc] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#ecfdf3] text-[#027a48] shadow-xs">
                      <PackageCheck size={20} strokeWidth={2.2} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#101828]">Último Recibo de Mercancía</h3>
                      <p className="mt-0.5 text-xs text-[#667085]">Registro de ingreso de productos más reciente.</p>
                    </div>
                  </div>
                </div>

                {overview.latestReceipt ? (
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#4f46e5]">{overview.latestReceipt.receiptNumber}</span>
                        <h4 className="mt-1 text-base font-bold text-[#101828]">{overview.latestReceipt.supplierName}</h4>
                        <p className="mt-0.5 text-xs text-[#667085]">
                          Sucursal: <span className="font-medium text-[#344054]">{overview.latestReceipt.branch}</span> · Recibido por: <span className="font-medium text-[#344054]">{overview.latestReceipt.receivedBy}</span>
                        </p>
                      </div>
                      <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-bold text-[#027a48]">
                        {overview.latestReceipt.status === "DRAFT" ? "BORRADOR" : "COMPLETADO"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[#eaecf0] bg-[#f8fafc] p-3 text-center">
                        <p className="font-mono text-xl font-bold text-[#101828]">{overview.latestReceipt.itemCount}</p>
                        <p className="mt-0.5 text-xs font-medium text-[#667085]">modelos / líneas</p>
                      </div>
                      <div className="rounded-xl border border-[#eaecf0] bg-[#f8fafc] p-3 text-center">
                        <p className="font-mono text-xl font-bold text-[#101828]">{overview.latestReceipt.unitCount}</p>
                        <p className="mt-0.5 text-xs font-medium text-[#667085]">unidades totales</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#f0f1f3] pt-3">
                      <span className="text-xs text-[#667085]">{formatDate(overview.latestReceipt.receivedAt)}</span>
                      <Link
                        href="/almacen/recibos"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#4f46e5] hover:text-[#4338ca]"
                      >
                        Abrir recibos de almacén <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-[#667085]">
                    Todavía no hay recibos de mercancía registrados.
                  </div>
                )}
              </div>

              {/* Solicitudes de Acceso de Usuarios */}
              <Link
                href="/configuracion"
                className="enterprise-panel group flex items-center justify-between gap-3.5 border-[#eaecf0] p-4.5 shadow-xs transition-all hover:border-[#c7d2fe] hover:shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5] shadow-xs">
                    <UserPlus size={19} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-[#101828]">Solicitudes de Acceso al Sistema</h4>
                    <p className="mt-0.5 text-xs text-[#667085]">
                      {overview.pendingAccessRequestCount > 0
                        ? `${overview.pendingAccessRequestCount} usuario(s) esperando aprobación de cuenta`
                        : "No hay solicitudes de nuevos usuarios pendientes"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {overview.pendingAccessRequestCount > 0 && (
                    <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs font-bold text-[#4338ca]">
                      {overview.pendingAccessRequestCount}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
                </div>
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
