"use client";

import { useRef } from "react";
import { Printer, Download, X, Building2, Phone, Calendar, User, FileText, CheckCircle2, ShieldCheck } from "lucide-react";

const COMPANY_ADDRESS = "Calle Duarte esquina Dr. Teofilo Ferry #54, La Romana";
const COMPANY_WHATSAPP = "(829) 266-0404";
const COMPANY_LABEL = "Se\u00f1al Digital";

function getItemIdentifiers(value: unknown) {
  if (typeof value !== "string") return [];

  return Array.from(new Set(value.split(/[\s,;]+/).map((identifier) => identifier.trim()).filter(Boolean)));
}

function RedactedAmount() {
  return (
    <span className="invoice-redacted-amount" aria-label="Precio oculto">
      RD$ 88,888.88
    </span>
  );
}

interface InvoicePDFPreviewModalProps {
  invoice: any;
  onClose: () => void;
}

export function InvoicePDFPreviewModal({ invoice, onClose }: InvoicePDFPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    const documentNode = printRef.current?.querySelector(".print-document");
    if (!(documentNode instanceof HTMLElement)) return;

    document.getElementById("invoice-print-root")?.remove();
    const printRoot = document.createElement("div");
    printRoot.id = "invoice-print-root";
    printRoot.innerHTML = documentNode.outerHTML;
    printRoot.querySelectorAll("[class]").forEach((element) => {
      const classNames = Array.from(element.classList)
        .filter((className) => !className.startsWith("print:"))
        .join(" ");
      element.setAttribute("class", classNames);
    });
    document.body.appendChild(printRoot);
    document.body.classList.add("invoice-printing");

    const cleanup = () => {
      document.body.classList.remove("invoice-printing");
      printRoot.remove();
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    window.print();
  };

  const issuedAt = new Date(invoice.createdAt || Date.now());
  const formattedDate = issuedAt.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Santo_Domingo",
  });
  const isConduce = invoice.type === "CONDUCE";
  const displayBranch = isConduce ? COMPANY_LABEL : invoice.branch;
  const itemCount = Array.isArray(invoice.items) ? invoice.items.length : 0;
  const printDensity = itemCount >= 16
    ? "invoice-print-density-tight"
    : itemCount >= 9
      ? "invoice-print-density-compact"
      : "invoice-print-density-normal";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#5750f1]" />
            <span className="font-bold text-sm">
              {isConduce ? "CONDUCE DE ENTREGA" : "FACTURA DE VENTA"} — {invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-[#5750f1]/30 transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimir Documento / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Document Printable Content Body */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0" ref={printRef}>
          <div className={`print-document ${printDensity} bg-white border border-slate-200 rounded-xl p-8 max-w-3xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 space-y-6`}>
            
            {/* Document Header */}
            <div className="invoice-document-header flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div className="min-w-0 flex-1 space-y-1 pr-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-[#5750f1] text-white font-black text-xl rounded-lg flex items-center justify-center shadow-md">
                    S
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">{COMPANY_LABEL}</h1>
                    <span className="text-[11px] text-slate-500 font-bold block">EQUIPOS Y TECNOLOGÍA MÓVIL</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-0.5 pt-2">
                  <p className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {displayBranch}, República Dominicana</p>
                  <p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp: {COMPANY_WHATSAPP}</p>
                  <p className="max-w-[30rem] break-words font-mono text-[11px] leading-4 text-slate-500">{COMPANY_ADDRESS}</p>
                </div>
              </div>

              <div className="w-[14rem] shrink-0 space-y-1 text-right">
                <span className={`inline-block px-3 py-1 text-xs font-black rounded-lg uppercase tracking-wider ${isConduce ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-[#5750f1]/10 text-[#5750f1] border border-[#5750f1]/20"}`}>
                  {isConduce ? "CONDUCE DE ENTREGA" : "FACTURA DE VENTA"}
                </span>
                <h2 className="text-lg font-black text-slate-900 font-mono pt-1">{invoice.invoiceNumber}</h2>
                {invoice.ncf && (
                  <p className="text-xs font-mono font-bold text-slate-700">NCF: {invoice.ncf}</p>
                )}
                <div className="invoice-issued-at mt-2 inline-flex items-center justify-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-slate-700">
                  <Calendar className="invoice-issued-icon h-4 w-4 shrink-0 text-[#5750f1]" />
                  <div className="leading-tight">
                    <span className="invoice-issued-date block text-[11px] font-bold">{formattedDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Info Grid */}
            <div className="invoice-client-info grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DATOS DEL CLIENTE / RECEPTOR</span>
                <p className="font-bold text-slate-900 text-sm">{invoice.clientName}</p>
                {invoice.clientTaxId && <p className="text-slate-600 font-mono">RNC/Cédula: <strong>{invoice.clientTaxId}</strong></p>}
                {invoice.clientPhone && <p className="text-slate-600">Tel: {invoice.clientPhone}</p>}
              </div>
            </div>

            {/* Items Table */}
            <div className="invoice-items-table overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Descripción de Equipo / Artículo</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    {!isConduce && <th className="px-4 py-3 text-right">Precio Unit. (RD$)</th>}
                    {!isConduce && <th className="px-4 py-3 text-right">ITBIS (18%)</th>}
                    <th className="px-4 py-3 text-right">{isConduce ? "Estado" : "Total (RD$)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {invoice.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 space-y-1">
                        <span className="font-bold text-slate-900 block">{item.description}</span>
                        {item.sku && <span className="text-[10px] font-mono text-slate-400 block">SKU: {item.sku}</span>}
                        {!isConduce && getItemIdentifiers(item.imeis).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {getItemIdentifiers(item.imeis).map((identifier) => (
                              <span key={identifier} className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-slate-600">
                                {/^\d{15}$/.test(identifier) ? "IMEI" : "SN"}: {identifier}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-black text-slate-800 text-sm">
                        {item.quantity}
                      </td>
                      {!isConduce && (
                        <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                          <RedactedAmount />
                        </td>
                      )}
                      {!isConduce && (
                        <td className="px-4 py-3.5 text-right font-medium text-slate-500">
                          <RedactedAmount />
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                        {isConduce ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-bold">
                            ENTREGADO
                          </span>
                        ) : (
                          <RedactedAmount />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="invoice-closing space-y-6">
              {/* Totals / Delivery Terms */}
              {!isConduce ? (
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
                  <div className="max-w-md space-y-1 text-xs text-slate-500">
                    <p className="font-bold text-slate-700 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Política de Garantía SDigital:
                    </p>
                    <p>
                      Todo cambio o reclamación requiere la factura física y sellos de seguridad intactos.
                    </p>
                  </div>

                  <div className="w-full sm:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-800">
                        <RedactedAmount />
                      </span>
                    </div>
                    {Number(invoice.discount) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Descuento:</span>
                        <span className="font-semibold">
                          <RedactedAmount />
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>ITBIS (18%):</span>
                      <span className="font-semibold text-slate-800">
                        <RedactedAmount />
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-[#5750f1] pt-2 border-t border-slate-200">
                      <span>TOTAL GENERAL:</span>
                      <RedactedAmount />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="invoice-delivery-terms bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                  <p className="font-bold">Conduce de Entrega Final — {displayBranch}</p>
                  <p className="text-[11px] mt-0.5">
                    Al firmar como "Recibido Conforme", el cliente acepta las políticas de la empresa y certifica que ha recibido la mercancía detallada.
                    Cualquier reclamo debe realizarse antes de retirar la mercancía. No nos hacemos responsables tras la salida.
                  </p>
                </div>
              )}

              {/* Signatures Section */}
              <div className="invoice-signatures grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-center text-xs">
                <div className="space-y-10">
                  <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-800">Entregado Por (Almacén / Chofer)</p>
                    <p className="text-[10px] text-slate-400 font-mono">Firma & Cédula</p>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-800">Recibido Conforme (Cliente / Receptor)</p>
                    <p className="text-[10px] text-slate-400 font-mono">Firma & Fecha de Recepción</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
