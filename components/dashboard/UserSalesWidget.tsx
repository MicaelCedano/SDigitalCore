"use client";

import Link from "next/link";
import {
  FileText,
  Tag,
  ArrowRight,
  Plus,
  TrendingUp,
  Receipt,
  Search,
  Sparkles,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface UserSalesWidgetProps {
  data: {
    recentInvoices: {
      id: string;
      invoiceNumber: string;
      clientName: string;
      branch: string;
      type: "FACTURA" | "CONDUCE";
      total: number;
      status: string;
      createdAt: Date;
    }[];
    invoicesCountToday: number;
    totalAmountToday: number;
    priceListTotalCount: number;
    priceListFeatured: {
      id: string;
      model: string;
      brand: string | null;
      capacity: string | null;
      wholesalePrice: number;
      retailPrice: number;
    }[];
  };
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function UserSalesWidget({ data }: UserSalesWidgetProps) {
  return (
    <div className="space-y-6">
      {/* Header del widget */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10">
            <TrendingUp size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Ventas & Facturación</h3>
            <p className="text-xs text-slate-500">
              Comprobantes emitidos, lista de precios actualizada y accesos rápidos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/facturas"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
          >
            <Plus size={14} /> Nueva Factura / Conduce
          </Link>
          <Link
            href="/precios"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
          >
            <Tag size={14} /> Lista de Precios
          </Link>
        </div>
      </div>

      {/* Grid de 2 columnas: Facturas recientes y Lista de precios destacada */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna 1: Facturas Recientes */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Últimos Comprobantes Emitidos
              </h4>
            </div>
            <Link
              href="/facturas"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.recentInvoices.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0 transition-colors hover:bg-slate-50/50 rounded-lg px-2"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                            inv.type === "FACTURA"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                              : "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                          }`}
                        >
                          {inv.invoiceNumber}
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {inv.clientName}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {inv.branch} · {formatDate(inv.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-slate-900">
                        RD$ {inv.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] font-medium text-slate-400">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay facturas o conduces recientes emitidos.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/30 px-4.5 py-2.5 flex items-center justify-between text-xs text-slate-500">
            <span>Hoy: {data.invoicesCountToday} comprobante(s)</span>
            <span className="font-semibold text-slate-700">
              Total hoy: RD$ {data.totalAmountToday.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Columna 2: Resumen Lista de Precios */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lista de Precios ({data.priceListTotalCount} modelos)
              </h4>
            </div>
            <Link
              href="/precios"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Consultar catálogo <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.priceListFeatured.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.priceListFeatured.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {item.brand ? `${item.brand} ` : ""}
                        {item.model}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.capacity || "Capacidad estándar"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400">Mayorista</p>
                        <p className="font-mono text-xs font-bold text-emerald-600">
                          RD$ {item.wholesalePrice.toLocaleString("es-DO")}
                        </p>
                      </div>
                      <div className="border-l border-slate-100 pl-3">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">Detalle</p>
                        <p className="font-mono text-xs font-bold text-slate-900">
                          RD$ {item.retailPrice.toLocaleString("es-DO")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay modelos activos en la lista de precios.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/30 px-4.5 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">Márgenes y combos configurados</span>
            <Link
              href="/precios"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              Abrir buscador rápido <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
