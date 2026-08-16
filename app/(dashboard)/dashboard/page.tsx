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
} from "lucide-react";

export const metadata: Metadata = { title: "Resumen general" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
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
      {/* Cabecera y accesos rápidos */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-[#101828] sm:text-[34px]">{greeting}, {firstName}</h2>
          <p className="mt-2 text-[15px] text-[#667085] sm:text-base">Aquí tienes lo que requiere atención y la actividad más reciente.</p>
        </div>
        {overview ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/qc/lotes" className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4338ca]">
              <Plus size={17} /> Nueva compra
            </Link>
            <Link href="/reparaciones/pagos" className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] shadow-xs transition-colors hover:bg-[#f8fafc]">
              <Coins size={16} className="text-[#b42318]" /> Aprobar pagos {overview.repairPendingCount > 0 ? `(${overview.repairPendingCount})` : ""}
            </Link>
          </div>
        ) : null}
      </section>

      {/* Banner de alerta de pagos y aprobaciones pendientes */}
      {overview && (overview.repairPendingCount > 0 || overview.unlockPendingCount > 0 || overview.qcSubmittedCount > 0 || overview.redemptionsPendingCount > 0) ? (
        <div className="flex flex-col gap-3.5 rounded-2xl border border-[#fecdca] bg-gradient-to-r from-[#fffbfa] to-[#fef3f2] p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3.5 sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fee4e2] text-[#d92d20] shadow-2xs">
              <AlertCircle size={22} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#b42318]">
                Atención: Hay pagos y aprobaciones pendientes en el sistema
              </p>
              <p className="mt-0.5 text-xs text-[#7a271a]">
                {overview.repairPendingCount > 0 && (
                  <span>
                    <strong>{overview.repairPendingCount} trabajo{overview.repairPendingCount === 1 ? "" : "s"}</strong> de reparación (RD$ {overview.repairPendingTotal.toLocaleString("es-DO")})
                  </span>
                )}
                {overview.repairPendingCount > 0 && overview.unlockPendingCount > 0 && " · "}
                {overview.unlockPendingCount > 0 && (
                  <span>
                    <strong>{overview.unlockPendingCount} solicitud{overview.unlockPendingCount === 1 ? "" : "es"}</strong> de desbloqueo (RD$ {overview.unlockPendingTotal.toLocaleString("es-DO")})
                  </span>
                )}
                {(overview.repairPendingCount > 0 || overview.unlockPendingCount > 0) && overview.qcSubmittedCount > 0 && " · "}
                {overview.qcSubmittedCount > 0 && (
                  <span>
                    <strong>{overview.qcSubmittedCount} lote{overview.qcSubmittedCount === 1 ? "" : "s"} QC</strong> listos para aceptar (RD$ {overview.qcSubmittedPendingTotal.toLocaleString("es-DO")})
                  </span>
                )}
                {(overview.repairPendingCount > 0 || overview.unlockPendingCount > 0 || overview.qcSubmittedCount > 0) && overview.redemptionsPendingCount > 0 && " · "}
                {overview.redemptionsPendingCount > 0 && (
                  <span>
                    <strong>{overview.redemptionsPendingCount} baucher{overview.redemptionsPendingCount === 1 ? "" : "es"}</strong> de retiro (RD$ {overview.redemptionsPendingTotal.toLocaleString("es-DO")})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/reparaciones/pagos"
              className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[#d92d20] px-4 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-[#b42318]"
            >
              Revisar pagos <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : null}

      {overview ? (
        <>
          {/* Fila principal de Widgets de Operación */}
          <section className="grid gap-5 xl:grid-cols-2" aria-label="Resumen de operaciones administrativas">
            {/* Widget de Pagos a Técnicos, Lotes QC y Desbloqueos (Aprobación Rápida) */}
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

            {/* Widget de Garantías y Movimientos */}
            <AdminWarrantyWidget
              cases={overview.recentWarrantyCases}
              events={overview.recentWarrantyEvents}
              counts={overview.warrantyCounts}
            />
          </section>

          {/* Fila secundaria: Almacén y accesos */}
          <section className="grid gap-5 xl:grid-cols-2" aria-label="Operaciones de Almacén y accesos">
            {/* Solicitudes de Almacén */}
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
                <div className="px-6 py-8 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#027a48]"><PackageCheck size={20} /></span>
                  <p className="mt-2 text-sm font-semibold text-[#344054]">No hay solicitudes pendientes</p>
                  <p className="mt-0.5 text-xs text-[#667085]">Todas las solicitudes de almacén están atendidas.</p>
                </div>
              )}
              <div className="border-t border-[#f0f1f3] bg-[#fcfcfd] px-5 py-3 text-right sm:px-6">
                <Link href="/almacen/transferencias" className="text-xs font-semibold text-[#4338ca] hover:text-[#3730a3]">Ver todas las solicitudes</Link>
              </div>
            </div>

            <div className="space-y-5">
              {/* Último Recibo de Mercancía */}
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
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xl font-bold text-[#101828]">{overview.latestReceipt.itemCount}</p><p className="mt-0.5 text-xs text-[#667085]">modelos / líneas</p></div>
                      <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-xl font-bold text-[#101828]">{overview.latestReceipt.unitCount}</p><p className="mt-0.5 text-xs text-[#667085]">unidades</p></div>
                    </div>
                    <p className="mt-3 text-xs text-[#667085]">{formatDate(overview.latestReceipt.receivedAt)}</p>
                    <Link href="/almacen/recibos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4338ca] hover:text-[#3730a3]">Abrir recibos <ArrowRight size={15} /></Link>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-[#667085]">Todavía no hay recibos de mercancía.</div>
                )}
              </div>

              {/* Solicitudes de Acceso */}
              <Link href="/configuracion" className="enterprise-panel group flex items-center gap-3.5 p-4 transition-colors hover:border-[#c7d2fe]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]"><UserPlus size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#101828]">Solicitudes de acceso</span><span className="mt-0.5 block text-xs text-[#667085]">{overview.pendingAccessRequestCount} usuario{overview.pendingAccessRequestCount === 1 ? "" : "s"} esperando aprobación</span></span>
                <ArrowRight size={16} className="text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
