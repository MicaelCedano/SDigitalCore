import Link from "next/link";
import { BatteryMedium, CheckCircle2, ClipboardCheck, CircleHelp, ShieldAlert, Smartphone } from "lucide-react";
import { ReviewedDevicesSearch } from "./ReviewedDevicesSearch";
import { ReviewedDevicesTable, type ReviewedInspection } from "./ReviewedDevicesTable";

interface ReviewedDevicesPageProps {
  inspections: ReviewedInspection[];
  stats: { total: number; functional: number; nonFunctional: number; unspecified: number; reviewedToday: number };
  filters: { query: string; result: "ALL" | "FUNCTIONAL" | "NON_FUNCTIONAL" | "UNSPECIFIED" };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function pageHref(page: number, filters: ReviewedDevicesPageProps["filters"]) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.result !== "ALL") params.set("result", filters.result);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/qc/equipos-revisados${query ? `?${query}` : ""}`;
}

export function ReviewedDevicesPage({ inspections, stats, filters, pagination }: ReviewedDevicesPageProps) {
  const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-[#eaecf0] px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <ClipboardCheck size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7f56d9]">Control de Calidad</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#101828]">Equipos revisados</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#667085]">Historial de equipos cuya inspección de calidad ya fue completada. No representa existencias de almacén.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-3 py-1.5 text-xs font-semibold text-[#475467]">
            <Smartphone size={14} /> Registro serializado por IMEI o serie
          </span>
        </div>

        <div className="grid gap-px bg-[#eaecf0] sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total revisados", value: stats.total, icon: ClipboardCheck, tone: "text-[#4f46e5] bg-[#eef2ff]" },
            { label: "Funcionales", value: stats.functional, icon: CheckCircle2, tone: "text-[#079455] bg-[#ecfdf3]" },
            { label: "No funcionales", value: stats.nonFunctional, icon: ShieldAlert, tone: "text-[#d92d20] bg-[#fef3f2]" },
            { label: "Sin clasificación", value: stats.unspecified, icon: CircleHelp, tone: "text-[#b54708] bg-[#fffaeb]" },
            { label: "Revisados hoy", value: stats.reviewedToday, icon: BatteryMedium, tone: "text-[#b54708] bg-[#fffaeb]" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 bg-white px-5 py-4 sm:px-6">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon size={18} /></span>
              <div><p className="text-2xl font-bold text-[#101828]">{stat.value.toLocaleString("es-DO")}</p><p className="text-xs font-medium text-[#667085]">{stat.label}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
        <ReviewedDevicesSearch initial={{ query: filters.query, result: filters.result }} />

        <div className="flex items-center justify-between border-b border-[#eaecf0] bg-[#fcfcfd] px-4 py-2.5 text-xs text-[#667085] sm:px-6">
          <span>Mostrando {first}-{last} de {pagination.total}</span>
          {filters.query || filters.result !== "ALL" ? <Link href="/qc/equipos-revisados" className="font-semibold text-[#4f46e5] hover:text-[#3730a3]">Limpiar filtros</Link> : null}
        </div>

        {inspections.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2f4f7] text-[#667085]"><ClipboardCheck size={22} /></span>
            <h2 className="mt-4 text-base font-semibold text-[#101828]">No hay equipos revisados para mostrar</h2>
            <p className="mt-1 max-w-md text-sm text-[#667085]">Las inspecciones completadas aparecerán aquí cuando se habilite el flujo de asignación y revisión de Control de Calidad.</p>
          </div>
        ) : (
          <ReviewedDevicesTable inspections={inspections} />
        )}

        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#eaecf0] px-4 py-3 sm:px-6">
            <Link aria-disabled={pagination.page <= 1} href={pageHref(Math.max(1, pagination.page - 1), filters)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pagination.page <= 1 ? "pointer-events-none border-[#eaecf0] text-[#98a2b3]" : "border-[#d0d5dd] text-[#344054] hover:bg-[#f9fafb]"}`}>Anterior</Link>
            <span className="text-sm text-[#667085]">Página {pagination.page} de {pagination.totalPages}</span>
            <Link aria-disabled={pagination.page >= pagination.totalPages} href={pageHref(Math.min(pagination.totalPages, pagination.page + 1), filters)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pagination.page >= pagination.totalPages ? "pointer-events-none border-[#eaecf0] text-[#98a2b3]" : "border-[#d0d5dd] text-[#344054] hover:bg-[#f9fafb]"}`}>Siguiente</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
