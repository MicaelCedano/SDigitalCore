"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Inbox,
  Package,
  Printer,
  RotateCcw,
  Search,
  Smartphone,
  Tag,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";
import { formatDateRD, formatDateTimeRD } from "@/lib/utils/format";
import { WARRANTY_DOCUMENT_LABELS } from "@/modules/garantias/lib/status-machine";
import { WarrantyDocumentPreviewModal } from "@/modules/garantias/components/WarrantyDocumentPreviewModal";
import type { WarrantyDocumentData } from "@/modules/garantias/actions/warranty";
import type { WarrantyDocumentType } from "@prisma/client";

interface WarrantyDocumentsListProps {
  initialDocuments: WarrantyDocumentData[];
}

type FilterCategory = "ALL" | "INTAKE" | "DELIVERY" | "TECHNICIAN" | "SUPPLIER" | "CREDIT_NOTE";

const DOCUMENT_TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof FileText;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    iconBg: string;
    iconText: string;
  }
> = {
  INTAKE_RECEIPT: {
    label: "Recibo de ingreso",
    icon: Inbox,
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    iconBg: "bg-blue-100/80",
    iconText: "text-blue-600",
  },
  TECHNICIAN_ASSIGNMENT: {
    label: "Entrega a técnico",
    icon: Wrench,
    badgeBg: "bg-violet-50",
    badgeText: "text-violet-700",
    badgeBorder: "border-violet-200",
    iconBg: "bg-violet-100/80",
    iconText: "text-violet-600",
  },
  TECHNICIAN_RECEIPT_REPAIRED: {
    label: "Recepción de técnico · Reparado",
    icon: Wrench,
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-200",
    iconBg: "bg-indigo-100/80",
    iconText: "text-indigo-600",
  },
  TECHNICIAN_RECEIPT_UNREPAIRED: {
    label: "Recepción de técnico · Sin reparar",
    icon: Wrench,
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200",
    iconBg: "bg-amber-100/80",
    iconText: "text-amber-600",
  },
  SUPPLIER_SHIPMENT: {
    label: "Envío a suplidor",
    icon: Truck,
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700",
    badgeBorder: "border-orange-200",
    iconBg: "bg-orange-100/80",
    iconText: "text-orange-600",
  },
  SUPPLIER_RECEIPT: {
    label: "Recepción de suplidor",
    icon: Truck,
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-700",
    badgeBorder: "border-cyan-200",
    iconBg: "bg-cyan-100/80",
    iconText: "text-cyan-600",
  },
  CUSTOMER_DELIVERY: {
    label: "Entrega al cliente (Conduce)",
    icon: FileCheck2,
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    iconBg: "bg-emerald-100/80",
    iconText: "text-emerald-600",
  },
  CREDIT_NOTE: {
    label: "Nota de crédito",
    icon: Tag,
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    iconBg: "bg-rose-100/80",
    iconText: "text-rose-600",
  },
};

function getDocConfig(type: string) {
  return (
    DOCUMENT_TYPE_CONFIG[type] ?? {
      label: WARRANTY_DOCUMENT_LABELS[type] ?? type.replaceAll("_", " "),
      icon: FileText,
      badgeBg: "bg-slate-50",
      badgeText: "text-slate-700",
      badgeBorder: "border-slate-200",
      iconBg: "bg-slate-100",
      iconText: "text-slate-600",
    }
  );
}

export function WarrantyDocumentsList({ initialDocuments }: WarrantyDocumentsListProps) {
  const [documents] = useState<WarrantyDocumentData[]>(initialDocuments);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");
  const [previewDoc, setPreviewDoc] = useState<WarrantyDocumentData | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Metrics computation
  const stats = useMemo(() => {
    let total = documents.length;
    let intakeCount = 0;
    let deliveryCount = 0;
    let techCount = 0;
    let supplierCount = 0;
    let creditCount = 0;
    let totalCasesCount = 0;

    for (const doc of documents) {
      totalCasesCount += doc.items?.length || 0;
      if (doc.type === "INTAKE_RECEIPT") intakeCount++;
      else if (doc.type === "CUSTOMER_DELIVERY") deliveryCount++;
      else if (doc.type.startsWith("TECHNICIAN_")) techCount++;
      else if (doc.type.startsWith("SUPPLIER_")) supplierCount++;
      else if (doc.type === "CREDIT_NOTE") creditCount++;
    }

    return {
      total,
      intakeCount,
      deliveryCount,
      techCount,
      supplierCount,
      creditCount,
      totalCasesCount,
    };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();

    return documents.filter((doc) => {
      // Category filter
      if (categoryFilter === "INTAKE" && doc.type !== "INTAKE_RECEIPT") return false;
      if (categoryFilter === "DELIVERY" && doc.type !== "CUSTOMER_DELIVERY") return false;
      if (categoryFilter === "TECHNICIAN" && !doc.type.startsWith("TECHNICIAN_")) return false;
      if (categoryFilter === "SUPPLIER" && !doc.type.startsWith("SUPPLIER_")) return false;
      if (categoryFilter === "CREDIT_NOTE" && doc.type !== "CREDIT_NOTE") return false;

      // Date filter
      if (dateFilter !== "ALL") {
        const docDate = new Date(doc.createdAt || doc.documentDate);
        const diffMs = now.getTime() - docDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateFilter === "TODAY") {
          const isToday =
            docDate.getDate() === now.getDate() &&
            docDate.getMonth() === now.getMonth() &&
            docDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === "WEEK" && diffDays > 7) {
          return false;
        } else if (dateFilter === "MONTH" && diffDays > 30) {
          return false;
        }
      }

      // Search query
      if (q) {
        const matchesCode = doc.documentCode.toLowerCase().includes(q);
        const matchesCounterparty = (doc.counterpartyName || "").toLowerCase().includes(q);
        const matchesNotes = (doc.notes || "").toLowerCase().includes(q);
        const matchesCreator = (doc.createdBy?.name || "").toLowerCase().includes(q);
        const matchesCases = doc.items?.some(
          (it) =>
            it.case.caseCode.toLowerCase().includes(q) ||
            it.case.imei.toLowerCase().includes(q) ||
            it.case.model.toLowerCase().includes(q) ||
            it.case.clientName.toLowerCase().includes(q) ||
            it.case.problem.toLowerCase().includes(q)
        );

        if (!matchesCode && !matchesCounterparty && !matchesNotes && !matchesCreator && !matchesCases) {
          return false;
        }
      }

      return true;
    });
  }, [documents, categoryFilter, dateFilter, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Link
                href="/garantias"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <ArrowLeft size={14} />
                Volver a Garantías
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-medium text-slate-400">Historial documental</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-[#4338ca] text-white shadow-md shadow-indigo-500/20">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Historial de Documentos
                </h1>
                <p className="text-xs text-slate-500">
                  Consulta, reimprime y verifica todos los recibos, conduces de entrega, remisiones y notas de crédito de garantías.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/garantias/nuevo"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition-all hover:bg-indigo-700 active:scale-98"
            >
              <Inbox size={15} />
              Nuevo Caso
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {/* Total Documents */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Documentos</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <FileText size={16} />
            </div>
          </div>
          <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-slate-900">
            {stats.total}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {stats.totalCasesCount} equipos vinculados
          </p>
        </div>

        {/* Intake Receipts */}
        <div className="group rounded-2xl border border-blue-100 bg-blue-50/40 p-4.5 shadow-2xs transition-all hover:border-blue-200 hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Recibos de Ingreso</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Inbox size={16} />
            </div>
          </div>
          <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-blue-900">
            {stats.intakeCount}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-blue-600/80">
            Ingresos al taller
          </p>
        </div>

        {/* Deliveries */}
        <div className="group rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4.5 shadow-2xs transition-all hover:border-emerald-200 hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Conduces de Entrega</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileCheck2 size={16} />
            </div>
          </div>
          <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-emerald-900">
            {stats.deliveryCount}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-emerald-600/80">
            Entregas a clientes
          </p>
        </div>

        {/* Technicians & Suppliers */}
        <div className="group rounded-2xl border border-violet-100 bg-violet-50/40 p-4.5 shadow-2xs transition-all hover:border-violet-200 hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-800">Técnicos y Suplidores</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Wrench size={16} />
            </div>
          </div>
          <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-violet-900">
            {stats.techCount + stats.supplierCount}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-violet-600/80">
            {stats.creditCount} Notas de crédito
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (REC-, COND-, TECN-), contraparte, IMEI, modelo, caso..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative inline-flex items-center">
              <Calendar size={14} className="pointer-events-none absolute left-3 text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                aria-label="Filtrar por período de fecha"
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-8.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-100/80 focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
              >
                <option value="ALL">Todo el tiempo</option>
                <option value="TODAY">Hoy</option>
                <option value="WEEK">Últimos 7 días</option>
                <option value="MONTH">Últimos 30 días</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▾
              </div>
            </div>

            {(categoryFilter !== "ALL" || dateFilter !== "ALL" || search) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("ALL");
                  setDateFilter("ALL");
                  setSearch("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <RotateCcw size={13} />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Tipo:
          </span>

          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            Todos
            <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("INTAKE")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "INTAKE"
                ? "bg-blue-600 text-white shadow-xs shadow-blue-600/20"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100/70"
            }`}
          >
            <Inbox size={13} />
            Recibos de Ingreso
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
              {stats.intakeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("DELIVERY")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "DELIVERY"
                ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/20"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
            }`}
          >
            <FileCheck2 size={13} />
            Conduces de Entrega
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
              {stats.deliveryCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("TECHNICIAN")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "TECHNICIAN"
                ? "bg-violet-600 text-white shadow-xs shadow-violet-600/20"
                : "bg-violet-50 text-violet-700 hover:bg-violet-100/70"
            }`}
          >
            <Wrench size={13} />
            Técnicos
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
              {stats.techCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("SUPPLIER")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "SUPPLIER"
                ? "bg-orange-600 text-white shadow-xs shadow-orange-600/20"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100/70"
            }`}
          >
            <Truck size={13} />
            Suplidores
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
              {stats.supplierCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("CREDIT_NOTE")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "CREDIT_NOTE"
                ? "bg-rose-600 text-white shadow-xs shadow-rose-600/20"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100/70"
            }`}
          >
            <Tag size={13} />
            Notas de Crédito
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
              {stats.creditCount}
            </span>
          </button>
        </div>
      </div>

      {/* Document List Presentation */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        {/* Table / List Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3.5 text-xs font-semibold text-slate-500">
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 sm:col-span-4">Documento & Tipo</div>
            <div className="col-span-4 sm:col-span-3">Contraparte & Beneficiario</div>
            <div className="hidden sm:col-span-3 sm:block">Equipos & Casos</div>
            <div className="col-span-3 text-right sm:col-span-2">Acciones</div>
          </div>
        </div>

        {/* List Content */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <h3 className="mt-3.5 text-sm font-bold text-slate-800">
              No se encontraron documentos
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              {search || categoryFilter !== "ALL" || dateFilter !== "ALL"
                ? "No hay resultados para los filtros o término de búsqueda seleccionado."
                : "Aún no se ha generado ningún documento de garantías en el sistema."}
            </p>
            {(search || categoryFilter !== "ALL" || dateFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("ALL");
                  setDateFilter("ALL");
                  setSearch("");
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                <RotateCcw size={13} />
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDocuments.map((doc) => {
              const config = getDocConfig(doc.type);
              const DocIcon = config.icon;
              const itemCount = doc.items?.length || 0;
              const isCopied = copiedCode === doc.documentCode;

              return (
                <div
                  key={doc.id}
                  className="group relative transition-colors hover:bg-slate-50/60"
                >
                  <div className="grid grid-cols-12 items-center gap-3 p-4 sm:p-5">
                    {/* Document Identification & Type */}
                    <div className="col-span-5 sm:col-span-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg} ${config.iconText}`}
                        >
                          <DocIcon size={20} />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-indigo-600">
                              {doc.documentCode}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(doc.documentCode, e)}
                              title="Copiar código de documento"
                              className="rounded p-1 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                            >
                              {isCopied ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                          <div>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
                            >
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock size={11} />
                            <span>{formatDateRD(doc.documentDate || doc.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Counterparty & Metadata */}
                    <div className="col-span-4 sm:col-span-3">
                      <div className="space-y-1">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {doc.counterpartyName || "Garantía interna"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Emitido por:{" "}
                          <span className="font-medium text-slate-700">
                            {doc.createdBy?.name || "Sistema"}
                          </span>
                        </p>
                        {doc.notes && (
                          <p className="line-clamp-1 text-[10.5px] italic text-slate-400">
                            "{doc.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Associated Cases & Devices */}
                    <div className="hidden sm:col-span-3 sm:block">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            <Smartphone size={11} className="text-slate-500" />
                            {itemCount} {itemCount === 1 ? "equipo" : "equipos"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {doc.items?.slice(0, 2).map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                            >
                              {item.case.caseCode} · {item.case.model}
                            </span>
                          ))}
                          {itemCount > 2 && (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              +{itemCount - 2} más
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="col-span-3 text-right sm:col-span-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick PDF Modal Preview */}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          title="Vista previa e impresión"
                          className="inline-flex items-center gap-1 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 hover:text-indigo-900 active:scale-95"
                        >
                          <Eye size={13} />
                          <span className="hidden md:inline">Ver PDF</span>
                        </button>

                        {/* Detail page navigation */}
                        <Link
                          href={`/garantias/documentos/${doc.documentCode}`}
                          title="Ir a página de documento"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 sm:px-2.5"
                        >
                          <ExternalLink size={13} />
                          <span className="hidden lg:inline">Detalle</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info bar */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
          <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
            <span>
              Mostrando <strong>{filteredDocuments.length}</strong> de{" "}
              <strong>{documents.length}</strong> documentos registrados
            </span>
            <span className="text-[11px] text-slate-400">
              Hora del sistema: República Dominicana (UTC-4)
            </span>
          </div>
        </div>
      </div>

      {/* Instant Document Preview Modal */}
      {previewDoc && (
        <WarrantyDocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
