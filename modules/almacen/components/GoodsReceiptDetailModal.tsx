"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportSingleReceiptToExcel } from "@/lib/utils/excel-export";
import {
  Check,
  Copy,
  FileSpreadsheet,
  Layers,
  MapPin,
  PackagePlus,
  Pencil,
  Truck,
  X,
} from "lucide-react";

type ReceiptColorVariant = {
  brand?: string | null;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  quantity?: number | null;
  imeis?: string | null;
};

type ReceiptItem = {
  id?: string;
  code?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  condition?: string | null;
  imeiOrSerial?: string | null;
  colorVariants?: ReceiptColorVariant[] | null;
  notes?: string | null;
};

type GoodsReceiptDetail = {
  id?: string;
  receiptNumber: string;
  supplierName: string;
  branch: string;
  receivedBy: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  receivedAt?: string | Date | null;
  createdAt?: string | Date | null;
  items?: ReceiptItem[] | null;
  warehouseImportedAt?: string | Date | null;
};

type ModelSummary = {
  key: string;
  description: string;
  quantity: number;
  colors: ColorImeiSummary[];
};

type ColorImeiSummary = {
  key: string;
  color: string;
  imeis: string[];
  quantity: number;
};

interface GoodsReceiptDetailModalProps {
  receipt: GoodsReceiptDetail;
  onClose: () => void;
  onEdit?: (receipt: GoodsReceiptDetail) => void;
  onImportToWarehouse?: (receipt: GoodsReceiptDetail) => void;
}

function parseImeis(value?: string | null) {
  if (!value) return [];

  return value
    .split(/[\n,;]+/)
    .map((imei) => imei.trim())
    .filter(Boolean);
}

function formatImeisForKaptas(imeis: string[]) {
  return [...new Set(imeis.map((imei) => imei.trim()).filter(Boolean))].join("\r\n");
}

function getItemImeis(item: ReceiptItem) {
  const variantImeis = (item.colorVariants || []).flatMap((variant) =>
    parseImeis(variant.imeis),
  );

  return variantImeis.length > 0 ? variantImeis : parseImeis(item.imeiOrSerial);
}

function getItemIdentity(item: ReceiptItem) {
  const variant = item.colorVariants?.find((candidate) => candidate.model || candidate.brand);
  const brand = variant?.brand?.trim() || "";
  const model = variant?.model?.trim() || item.description?.trim() || "";
  const capacity = variant?.capacity?.trim() || "";
  const label = [brand, model, capacity].filter(Boolean).join(" ") || "Modelo no especificado";

  return {
    label,
    key: label.toLocaleLowerCase("es-DO"),
  };
}

function getItemQuantity(item: ReceiptItem) {
  const variants = item.colorVariants || [];
  if (variants.length > 0) {
    return variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 1), 0);
  }
  return item.quantity || getItemImeis(item).length || 1;
}

function getItemColorImeis(item: ReceiptItem): ColorImeiSummary[] {
  const groupedVariants = new Map<string, ColorImeiSummary>();

  for (const variant of item.colorVariants || []) {
    const color = variant.color?.trim() || "General";
    const key = color.toLocaleLowerCase("es-DO");
    const imeis = parseImeis(variant.imeis);
    const current = groupedVariants.get(key);
    if (current) {
      current.imeis = [...new Set([...current.imeis, ...imeis])];
      current.quantity += variant.quantity || 1;
    } else {
      groupedVariants.set(key, { key, color, imeis: [...new Set(imeis)], quantity: variant.quantity || 1 });
    }
  }

  const variants = [...groupedVariants.values()];

  if (variants.length > 0) return variants;

  const legacyImeis = parseImeis(item.imeiOrSerial);
  return legacyImeis.length > 0
    ? [{ key: "general", color: "General", imeis: [...new Set(legacyImeis)], quantity: item.quantity || legacyImeis.length }]
    : [];
}

function summarizeModels(items: ReceiptItem[]): ModelSummary[] {
  const grouped = new Map<string, ModelSummary>();

  for (const item of items) {
    const identity = getItemIdentity(item);
    const quantity = getItemQuantity(item);
    const current = grouped.get(identity.key);
    const colorGroups = getItemColorImeis(item);

    if (current) {
      current.quantity += quantity;
      for (const colorGroup of colorGroups) {
        const existingColor = current.colors.find((color) => color.key === colorGroup.key);
        if (existingColor) {
          existingColor.imeis = [...new Set([...existingColor.imeis, ...colorGroup.imeis])];
        } else {
          current.colors.push(colorGroup);
        }
      }
      continue;
    }

    grouped.set(identity.key, {
      key: identity.key,
      description: identity.label,
      quantity,
      colors: colorGroups,
    });
  }

  return [...grouped.values()];
}

export function GoodsReceiptDetailModal({
  receipt,
  onClose,
  onEdit,
  onImportToWarehouse,
}: GoodsReceiptDetailModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const models = useMemo(
    () => summarizeModels(receipt.items || []),
    [receipt.items],
  );

  const formattedDate = new Date(
    receipt.receivedAt || receipt.createdAt || new Date(),
  ).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  });

  const totalQty = models.reduce((sum, model) => sum + model.quantity, 0);
  const receiptSummary = [
    `Recibiendo de ${receipt.supplierName}`,
    ...models.map((model) => `${model.description} - ${model.quantity}`),
  ].join("\n");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, [onClose]);

  async function copyText(text: string, key: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }

  const handleExportExcel = () => {
    exportSingleReceiptToExcel({
      receiptNumber: receipt.receiptNumber,
      supplierName: receipt.supplierName,
      branch: receipt.branch,
      receivedBy: receipt.receivedBy,
      status: receipt.status,
      notes: receipt.notes,
      receivedAt: receipt.receivedAt || receipt.createdAt || new Date(),
      items: (receipt.items || []).map((item) => ({
        code: item.code,
        description: item.description?.trim() || "Modelo no especificado",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        condition: item.condition,
        imeiOrSerial: getItemImeis(item).join("\n") || item.imeiOrSerial,
        notes: item.notes,
        colorVariants: item.colorVariants,
      })),
    });
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs"
        onClick={onClose}
        aria-label="Cerrar resumen del recibo"
      />
      <section
        className="fixed inset-x-3 top-1/2 z-50 mx-auto flex max-h-[92vh] w-auto max-w-4xl -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl sm:inset-x-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-detail-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl border border-[#5750f1]/20 bg-[#5750f1]/10 p-2.5 text-[#5750f1]">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="receipt-detail-title" className="truncate text-lg font-bold text-slate-800">
                  Recibo {receipt.receiptNumber}
                </h2>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    receipt.status === "COMPLETED"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : receipt.status === "DRAFT"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {receipt.status === "COMPLETED"
                    ? "COMPLETADO"
                    : receipt.status === "DRAFT"
                      ? "BORRADOR"
                      : "CANCELADO"}
                </span>
                {receipt.warehouseImportedAt && (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">ENVIADO A ALMACÉN</span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500">
                Registrado el {formattedDate} por {receipt.receivedBy}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar resumen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-white p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Proveedor</span>
              <span className="block truncate text-sm font-bold text-slate-800">
                {receipt.supplierName}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Sucursal / Almacén</span>
              <span className="flex items-center gap-1 text-sm font-bold text-slate-800">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#5750f1]" />
                <span className="truncate">{receipt.branch}</span>
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Modelos / Unidades</span>
              <span className="block text-sm font-bold text-[#5750f1]">
                {models.length} {models.length === 1 ? "modelo" : "modelos"} · {totalQty} uds
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                  Resumen para compartir
                </p>
                <div className="mt-3 space-y-1 text-sm text-slate-800">
                  <p className="font-bold">Recibiendo de {receipt.supplierName}</p>
                  {models.map((model) => (
                    <p key={model.key}>
                      {model.description} - <strong>{model.quantity}</strong>
                    </p>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyText(receiptSummary, "summary")}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                {copiedKey === "summary" ? (
                  <><Check className="h-4 w-4 text-emerald-600" /> Copiado</>
                ) : (
                  <><Copy className="h-4 w-4" /> Copiar resumen</>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
              <Layers className="h-4 w-4 text-[#5750f1]" /> Identificación por modelo y color
            </h3>

            <div className="space-y-3">
              {models.map((model) => (
                <article key={model.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{model.description}</h4>
                    <p className="mt-0.5 text-xs font-semibold text-[#5750f1]">
                      {model.quantity} unidades
                    </p>
                  </div>

                  {model.colors.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {model.colors.map((color) => (
                        <div
                          key={color.key}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">{color.color}</p>
                            <p className="text-[11px] font-medium text-slate-500">
                              {color.quantity} {color.quantity === 1 ? "unidad" : "unidades"}
                              {color.imeis.length > 0
                                ? ` · ${color.imeis.length} ${color.imeis.length === 1 ? "IMEI / serie" : "IMEIs / series"}`
                                : " · sin IMEI / serie"}
                            </p>
                          </div>
                          {color.imeis.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(
                                  formatImeisForKaptas(color.imeis),
                                  `color-${model.key}-${color.key}`,
                                )
                              }
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                            >
                              {copiedKey === `color-${model.key}-${color.key}` ? (
                                <><Check className="h-3.5 w-3.5" /> Copiados</>
                              ) : (
                                <><Copy className="h-3.5 w-3.5" /> Copiar IMEIs</>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      Este modelo no tiene IMEIs registrados.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>

          {receipt.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <span className="mb-1 block font-bold text-slate-800">Observaciones generales</span>
              <p>{receipt.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Descargar Excel
          </button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {receipt.status === "COMPLETED" && !receipt.warehouseImportedAt && onImportToWarehouse && (
              <button type="button" onClick={() => { onClose(); onImportToWarehouse(receipt); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5750f1] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#463ec5]"><PackagePlus className="h-4 w-4" /> Importar a almacén</button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Cerrar
            </button>
            {receipt.status === "DRAFT" && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(receipt);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-700"
              >
                <Pencil className="h-4 w-4" /> Editar / finalizar borrador
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
