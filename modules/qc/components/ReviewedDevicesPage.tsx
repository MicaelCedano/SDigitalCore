import Link from "next/link";
import { BatteryMedium, CheckCircle2, ClipboardCheck, Search, ShieldAlert, Smartphone } from "lucide-react";
import { formatDateTimeRD } from "@/lib/utils/format";

type ReviewedInspection = {
  id: string;
  result: "FUNCTIONAL" | "NON_FUNCTIONAL" | null;
  grade: string | null;
  batteryHealth: number | null;
  reviewedAt: Date | null;
  reviewerNameSnapshot: string;
  device: {
    id: string;
    imei: string | null;
    serialNumber: string | null;
    brand: string | null;
    model: string;
    storageGb: number | null;
    color: string | null;
    status: string;
  };
};

interface ReviewedDevicesPageProps {
  inspections: ReviewedInspection[];
  stats: { total: number; functional: number; nonFunctional: number; reviewedToday: number };
  filters: { query: string; result: "ALL" | "FUNCTIONAL" | "NON_FUNCTIONAL" };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function resultLabel(result: ReviewedInspection["result"]) {
  if (result === "FUNCTIONAL") return "Funcional";
  if (result === "NON_FUNCTIONAL") return "No funcional";
  return "Sin resultado";
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

        <div className="grid gap-px bg-[#eaecf0] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total revisados", value: stats.total, icon: ClipboardCheck, tone: "text-[#4f46e5] bg-[#eef2ff]" },
            { label: "Funcionales", value: stats.functional, icon: CheckCircle2, tone: "text-[#079455] bg-[#ecfdf3]" },
            { label: "No funcionales", value: stats.nonFunctional, icon: ShieldAlert, tone: "text-[#d92d20] bg-[#fef3f2]" },
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
        <form method="get" className="flex flex-col gap-3 border-b border-[#eaecf0] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">Buscar equipos revisados</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
            <input name="q" defaultValue={filters.query} maxLength={120} placeholder="Buscar IMEI, serie, modelo o QC..." className="focus-ring h-10 w-full rounded-lg border border-[#d0d5dd] bg-white pl-10 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98a2b3]" />
          </label>
          <div className="flex gap-2">
            <select name="result" defaultValue={filters.result} aria-label="Filtrar por resultado" className="focus-ring h-10 min-w-40 rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#344054] outline-none">
              <option value="ALL">Todos los resultados</option>
              <option value="FUNCTIONAL">Funcionales</option>
              <option value="NON_FUNCTIONAL">No funcionales</option>
            </select>
            <button type="submit" className="focus-ring h-10 rounded-lg bg-[#4f46e5] px-4 text-sm font-semibold text-white hover:bg-[#4338ca]">Filtrar</button>
          </div>
        </form>

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
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
                <tr><th className="px-6 py-3">Equipo</th><th className="px-4 py-3">Identificador</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Calidad</th><th className="px-4 py-3">Revisado por</th><th className="px-6 py-3 text-right">Fecha</th></tr>
              </thead>
              <tbody className="divide-y divide-[#eaecf0]">
                {inspections.map((inspection) => (
                  <tr key={inspection.id} className="hover:bg-[#fcfcfd]">
                    <td className="px-6 py-4"><p className="font-semibold text-[#101828]">{[inspection.device.brand, inspection.device.model].filter(Boolean).join(" ")}</p><p className="mt-0.5 text-xs text-[#667085]">{[inspection.device.storageGb ? `${inspection.device.storageGb} GB` : null, inspection.device.color].filter(Boolean).join(" · ") || "Sin detalles adicionales"}</p></td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold text-[#344054]">{inspection.device.imei ?? inspection.device.serialNumber ?? "—"}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${inspection.result === "FUNCTIONAL" ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]" : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"}`}>{resultLabel(inspection.result)}</span></td>
                    <td className="px-4 py-4 text-[#475467]"><span className="font-semibold text-[#344054]">{inspection.grade ? `Grado ${inspection.grade}` : "Sin grado"}</span>{inspection.batteryHealth !== null ? <span className="ml-2 text-xs">· {inspection.batteryHealth}% batería</span> : null}</td>
                    <td className="px-4 py-4 font-medium text-[#344054]">{inspection.reviewerNameSnapshot}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-[#667085]">{inspection.reviewedAt ? formatDateTimeRD(inspection.reviewedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
