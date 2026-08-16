"use client";

import Link from "next/link";
import {
  Warehouse,
  ArrowRight,
  Plus,
  PackageCheck,
  ClipboardList,
  Boxes,
  ExternalLink,
} from "lucide-react";

interface UserWarehouseWidgetProps {
  data: {
    pendingRequestsCount: number;
    myRequests: {
      id: string;
      requestCode: string;
      title: string;
      branch: string;
      type: "ENTRY" | "EXIT";
      status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
      createdAt: Date;
      itemCount: number;
    }[];
    latestReceipt: {
      id: string;
      receiptNumber: string;
      supplierName: string;
      branch: string;
      receivedBy: string;
      receivedAt: Date;
      unitCount: number;
      status: string;
    } | null;
    totalProductsCount: number;
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

export function UserWarehouseWidget({ data }: UserWarehouseWidgetProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/10">
            <Warehouse size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Almacén & Inventario</h3>
            <p className="text-xs text-slate-500">
              Solicitudes de mercancía, recibos de compras y productos en stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/almacen/transferencias"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus size={14} /> Nueva Solicitud
          </Link>
          <Link
            href="/almacen"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
          >
            Ver Productos <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Grid de 2 columnas: Solicitudes y Último Recibo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna 1: Solicitudes de Almacén */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Solicitudes de Almacén
              </h4>
            </div>
            <Link
              href="/almacen/transferencias"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.myRequests.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {data.myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                          {req.requestCode}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            req.status === "PENDING"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60"
                              : req.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {req.status === "PENDING"
                            ? "PENDIENTE"
                            : req.status === "APPROVED"
                            ? "APROBADA"
                            : req.status}
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {req.title}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {req.branch} · {req.itemCount} artículo(s) · {formatDate(req.createdAt)}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                      {req.type === "ENTRY" ? "Entrada" : "Salida"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay solicitudes de almacén registradas.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/30 px-4.5 py-2.5 flex items-center justify-between text-xs text-slate-500">
            <span>Pendientes por procesar: {data.pendingRequestsCount}</span>
            <Link
              href="/almacen/transferencias"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              Crear solicitud
            </Link>
          </div>
        </div>

        {/* Columna 2: Último Recibo de Mercancía */}
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4.5 py-3">
            <div className="flex items-center gap-2">
              <PackageCheck size={16} className="text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Último Recibo de Mercancía
              </h4>
            </div>
            <Link
              href="/almacen/recibos"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              Ver historial <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-4 flex-1">
            {data.latestReceipt ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-900 border border-slate-200/60">
                      {data.latestReceipt.receiptNumber}
                    </span>
                    <h5 className="mt-1 text-sm font-bold text-slate-900">
                      {data.latestReceipt.supplierName}
                    </h5>
                    <p className="text-xs text-slate-500">
                      Recibido por {data.latestReceipt.receivedBy} · {data.latestReceipt.branch}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                    {data.latestReceipt.status === "DRAFT" ? "BORRADOR" : "COMPLETADO"}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                  <p className="font-mono text-xl font-bold text-slate-900">
                    {data.latestReceipt.unitCount}
                  </p>
                  <p className="text-xs text-slate-500">unidades ingresadas</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay recibos de mercancía recientes.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/30 px-4.5 py-2.5 flex items-center justify-between text-xs text-slate-500">
            <span>Productos en catálogo: {data.totalProductsCount}</span>
            <Link href="/almacen/recibos" className="font-semibold text-emerald-600 hover:text-emerald-800">
              Registrar nuevo recibo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
