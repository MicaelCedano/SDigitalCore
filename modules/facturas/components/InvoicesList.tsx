"use client";

import { useState, useEffect } from "react";
import { getInvoicesAction, deleteInvoiceAction } from "../actions/invoice";
import { InvoiceGenerator } from "./InvoiceGenerator";
import { InvoicePDFPreviewModal } from "./InvoicePDFPreviewModal";
import { ChargerClassifier } from "./ChargerClassifier";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Printer,
  Trash2,
  Calendar,
  User,
  Building2,
  Truck,
  DollarSign,
  Eye,
  Filter,
} from "lucide-react";

export function InvoicesList() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [showGenerator, setShowGenerator] = useState(false);
  const [showChargerClassifier, setShowChargerClassifier] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    const res = await getInvoicesAction(search, typeFilter);
    if (res.success && res.data) {
      setInvoices(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, typeFilter]);

  const handleCreatedSuccess = (createdInvoice: any) => {
    setShowGenerator(false);
    setSelectedInvoice(createdInvoice);
    fetchInvoices();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de eliminar esta factura/conduce?")) {
      await deleteInvoiceAction(id);
      fetchInvoices();
    }
  };

  const totalInvoices = invoices.filter((i) => i.type === "FACTURA").length;
  const totalConduces = invoices.filter((i) => i.type === "CONDUCE").length;
  const totalBilled = invoices
    .filter((i) => i.type === "FACTURA")
    .reduce((acc, i) => acc + (i.total || 0), 0);

  if (showGenerator) {
    return (
      <InvoiceGenerator
        onSuccess={handleCreatedSuccess}
        onCancel={() => setShowGenerator(false)}
      />
    );
  }

  if (showChargerClassifier) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <button onClick={() => setShowChargerClassifier(false)} className="text-xs font-bold text-slate-500 hover:text-slate-900">← Volver a facturas y conduces</button>
        <ChargerClassifier />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Facturas & Conduces de Entrega PDF
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              El conduce va primero: genera documentos de entrega y consulta tus facturas desde un solo módulo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowChargerClassifier(true)} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100">
            <span className="text-base">⚡</span> Cargadores
          </button>
          <button
            onClick={() => setShowGenerator(true)}
            className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2 shrink-0"
          >
            <Truck className="w-4 h-4" /> Nuevo Conduce
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Facturas Emitidas</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {totalInvoices}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-600 font-medium block">Conduces de Entrega</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {totalConduces} <span className="text-xs font-semibold text-slate-500">conduces</span>
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5750f1] font-medium block">Monto Total Facturado</span>
            <span className="text-2xl font-black text-[#5750f1] mt-1 block">
              RD$ {totalBilled.toLocaleString("es-DO", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, NCF o cliente..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5750f1]"
            >
              <option value="ALL">Todos los Documentos</option>
              <option value="FACTURA">Facturas de Venta</option>
              <option value="CONDUCE">Conduces de Entrega</option>
            </select>
          </div>

          <button
            onClick={fetchInvoices}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Recargar facturas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando facturas y conduces...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No hay facturas o conduces emitidos</p>
            <p className="text-xs text-slate-500">
              Presiona &quot;Nueva Factura / Conduce&quot; para generar un comprobante PDF.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Número Documento</th>
                  <th className="px-4 py-3">Fecha & Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sucursal / Origen</th>
                  <th className="px-4 py-3 text-right">Monto Total</th>
                  <th className="px-4 py-3 text-right">Acciones PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const formattedDate = new Date(inv.createdAt).toLocaleString("es-DO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-extrabold text-[10px] px-2.5 py-1 rounded-full border ${
                            inv.type === "FACTURA"
                              ? "bg-[#5750f1]/10 text-[#5750f1] border-[#5750f1]/20"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {inv.type === "FACTURA" ? "FACTURA" : "CONDUCE"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        <span className="block text-xs">{inv.invoiceNumber}</span>
                        {inv.ncf && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            NCF: {inv.ncf}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800 block text-xs">{inv.clientName}</span>
                        {inv.clientTaxId && (
                          <span className="text-[10px] font-mono text-slate-500 block">
                            RNC: {inv.clientTaxId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inv.branch || "Almacén Casita"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 text-sm">
                        {inv.type === "CONDUCE"
                          ? "DESPACHADO"
                          : `RD$ ${Number(inv.total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-3 py-1 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> PDF / Ver
                          </button>
                          <button
                            onClick={(e) => handleDelete(inv.id, e)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                            title="Eliminar documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Modal */}
      {selectedInvoice && (
        <InvoicePDFPreviewModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
