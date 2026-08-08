"use client";

import { useState, type ChangeEvent } from "react";
import { createInvoiceAction } from "../actions/invoice";
import { extractInvoiceFromPDF } from "../actions/pdf-extraction";
import { InvoiceInput } from "@/lib/validation/invoice";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Building2,
  User,
  DollarSign,
  Barcode,
  Truck,
  Eye,
  Sparkles,
} from "lucide-react";

interface InvoiceGeneratorProps {
  onSuccess: (invoice: any) => void;
  onCancel: () => void;
}

export function InvoiceGenerator({ onSuccess, onCancel }: InvoiceGeneratorProps) {
  const [type, setType] = useState<"FACTURA" | "CONDUCE">("CONDUCE");
  const [clientName, setClientName] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [ncf, setNcf] = useState("B0100000101");
  const [branch, setBranch] = useState("Almacén Casita");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [discount, setDiscount] = useState<number | string>(0);
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<any[]>([
    {
      description: "iPhone 15 Pro Max 256GB Azul Titania",
      sku: "IP15PM-256",
      imeis: "",
      quantity: 2,
      unitPrice: 0,
      applyTax: true,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  const handlePDFUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setExtracting(true);
    setExtractMsg(null);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await extractInvoiceFromPDF(formData);
      if (!result.success) {
        setExtractMsg(result.error);
        return;
      }

      setClientName(result.data.clientName);
      if (result.data.invoiceReference) setNcf(result.data.invoiceReference);
      if (result.data.items.length > 0) {
        setItems(result.data.items.map((item) => ({
          description: item.description,
          sku: "",
          imeis: "",
          quantity: item.quantity,
          unitPrice: 0,
          applyTax: true,
        })));
        setExtractMsg(`${result.data.items.length} ítems extraídos. Revisa los datos antes de emitir.`);
      } else {
        setExtractMsg("Se leyeron los datos generales, pero no se detectaron ítems. Agrégalos manualmente.");
      }
    } catch {
      setExtractMsg("No se pudo procesar el PDF. Completa los datos manualmente.");
    } finally {
      setExtracting(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: "",
        sku: "",
        imeis: "",
        quantity: 1,
        unitPrice: 0,
        applyTax: true,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Calculations
  const calculatedItems = items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const itemSubtotal = qty * price;
    const itemTax = item.applyTax && type === "FACTURA" ? itemSubtotal * 0.18 : 0;
    const itemTotal = itemSubtotal + itemTax;

    return {
      ...item,
      tax: itemTax,
      totalPrice: itemTotal,
    };
  });

  const subtotal = calculatedItems.reduce((acc, i) => acc + i.quantity * (Number(i.unitPrice) || 0), 0);
  const taxTotal = calculatedItems.reduce((acc, i) => acc + i.tax, 0);
  const discTotal = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal + taxTotal - discTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!clientName.trim()) {
      setErrorMsg("El nombre del cliente es obligatorio.");
      return;
    }

    if (items.some((i) => !i.description.trim())) {
      setErrorMsg("Todos los artículos deben tener una descripción.");
      return;
    }

    setSaving(true);

    try {
      const payload: InvoiceInput = {
        type,
        ncf: ncf.trim() || undefined,
        clientName: clientName.trim(),
        clientTaxId: clientTaxId.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        branch,
        paymentMethod,
        subtotal,
        tax: taxTotal,
        discount: discTotal,
        total: grandTotal,
        notes: notes.trim() || undefined,
        items: calculatedItems.map((i) => ({
          description: i.description,
          sku: i.sku || undefined,
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          tax: i.tax,
          totalPrice: i.totalPrice,
        })),
      };

      const res = await createInvoiceAction(payload);
      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setErrorMsg(res.error || "Error al emitir el documento");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Emitir {type === "FACTURA" ? "Factura de Venta" : "Conduce de Entrega"}
            </h2>
              <p className="text-xs text-slate-500">
              El conduce es el documento principal. Completa el cliente y los artículos entregados.
            </p>
          </div>
        </div>

        {/* Type Toggle */}
        <div className="flex items-center bg-slate-200 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setType("CONDUCE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              type === "CONDUCE"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Truck className="mr-1 inline h-3.5 w-3.5" /> Conduce
          </button>
          <button
            type="button"
            onClick={() => setType("FACTURA")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              type === "FACTURA"
                ? "bg-[#5750f1] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Factura Venta
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="rounded-xl border border-dashed border-[#5750f1]/40 bg-[#5750f1]/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Importar factura PDF del proveedor</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Detecta cliente, referencia y artículos; podrás revisar y corregir todo antes de guardar.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#5750f1] shadow-sm ring-1 ring-[#5750f1]/20 transition hover:bg-[#5750f1] hover:text-white">
              <input type="file" accept="application/pdf" className="sr-only" onChange={handlePDFUpload} disabled={extracting} />
              {extracting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {extracting ? "Leyendo PDF..." : "Seleccionar PDF"}
            </label>
          </div>
          {extractMsg && <p className="mt-3 text-[11px] font-semibold text-[#5750f1]">{extractMsg}</p>}
        </div>

        {/* Client Info Grid */}
        <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#5750f1]" /> Información del Cliente & NCF
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Cliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Juan Pérez / Inversiones SDigital SRL"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                RNC / Cédula (Opcional)
              </label>
              <input
                type="text"
                value={clientTaxId}
                onChange={(e) => setClientTaxId(e.target.value)}
                placeholder="Ej. 130999999 / 001-1234567-8"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="809-555-0199"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección de Entrega
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Ej. Av. 27 de Febrero #50, Santo Domingo"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NCF / Comprobante</label>
              <input
                type="text"
                value={ncf}
                onChange={(e) => setNcf(e.target.value)}
                placeholder="Ej. B0100000101"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-[#5750f1]" /> Artículos del conduce
            </h3>

            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Agregar Ítem
            </button>
          </div>

          <div className="space-y-3">
            {calculatedItems.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Descripción del Equipo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      placeholder="Ej. iPhone 15 Pro Max 256GB"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">SKU</label>
                    <input
                      type="text"
                      value={item.sku || ""}
                      onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                      placeholder="IP15PM-256"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#5750f1]"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-center">
                      Cant.
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-[#5750f1]"
                    />
                  </div>

                  {type === "FACTURA" && (
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 text-right">
                        Precio Unitario (RD$)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-extrabold text-[#5750f1] text-right focus:outline-none focus:border-[#5750f1]"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-1 flex items-center justify-end pt-5">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Totals and Footer Control */}
        <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="w-full sm:w-80 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Notas adicionales en comprobante</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Entregado con sellos de garantía intactos..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
            />
          </div>

          {type === "FACTURA" && <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">RD$ {subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>

            {type === "FACTURA" && (
              <div className="flex justify-between text-slate-600">
                <span>ITBIS (18%):</span>
                <span className="font-semibold">RD$ {taxTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-600 pt-1">
              <span>Descuento (RD$):</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 bg-white border border-slate-200 rounded px-2 py-0.5 text-right font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
              />
            </div>

            <div className="flex justify-between text-sm font-black text-[#5750f1] pt-2 border-t border-slate-200">
              <span>TOTAL PROYECTADO:</span>
              <span>RD$ {grandTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-[#5750f1]/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Emitir & Previsualizar PDF
          </button>
        </div>
      </form>
    </div>
  );
}
