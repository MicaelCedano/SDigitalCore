"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { WarehouseProduct } from "@prisma/client";
import { ArrowLeft, Check, FilePenLine, Plus, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { createWarehouseRequestAction, getWarehouseProductsAction } from "../actions/warehouse";
import type { WarehouseRequestFormData } from "../hooks/useWarehouseRequestDraft";
import { availableQuantity } from "../lib/warehouse-stock";

type Product = Pick<WarehouseProduct, "id" | "code" | "name" | "brand" | "color" | "capacity" | "boxes" | "looseUnits" | "totalUnits" | "unitsPerBox">;
type DraftItem = WarehouseRequestFormData["items"][number];
type Options = { products: Product[]; branches: { id: string; name: string }[] };
type UpdateForm = (form: WarehouseRequestFormData) => WarehouseRequestFormData;

const selectStyle = "h-11 w-full min-w-0 rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 disabled:bg-slate-50";
const unitFormat = new Intl.NumberFormat("es-DO");

type Props = {
  form: WarehouseRequestFormData;
  saved: boolean;
  storageError: boolean;
  onChange: (update: UpdateForm) => void;
  onClose: () => void;
  onSent: (code: string) => void;
};

export function WarehouseRequestForm({ form, saved, storageError, onChange, onClose, onSent }: Props) {
  const [options, setOptions] = useState<Options | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const productSearch = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const isExit = form.type === "EXIT";

  useEffect(() => { heading.current?.focus(); }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getWarehouseProductsAction(), getBranchesAction(true)])
      .then(([products, branches]) => {
        if (!active) return;
        setOptions(products.success && branches.success
          ? { products: products.data ?? [], branches: branches.data ?? [] }
          : "error");
      })
      .catch(() => { if (active) setOptions("error"); });
    return () => { active = false; };
  }, [attempt]);

  const catalog = options === "error" ? null : options;
  const productById = useMemo(() => new Map(catalog?.products.map((product) => [product.id, product])), [catalog]);
  const pickedIds = new Set(form.items.map((item) => item.productId));
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (catalog?.products ?? []).filter((product) => {
    if (pickedIds.has(product.id) || (isExit && product.totalUnits <= 0)) return false;
    const text = [product.name, product.code, product.brand, product.color, product.capacity].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const selectedItems = form.items.map((item) => {
    const product = productById.get(item.productId);
    const quantity = Number(item.quantity);
    const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
    const max = isExit && product ? availableQuantity(product, item.measure) : undefined;
    const unitsCount = validQuantity ? quantity * (item.measure === "BOXES" ? Math.max(1, product?.unitsPerBox ?? 1) : 1) : 0;
    const issue = catalog && !product ? "Este producto ya no está disponible. Quítalo de la solicitud."
      : max === 0 ? "Sin existencias en esta presentación."
      : max !== undefined && quantity > max ? `Ajusta la cantidad. Disponible: ${unitFormat.format(max)}.`
      : item.quantity && !validQuantity ? "Escribe una cantidad entera mayor que cero."
      : null;
    return { item, product, quantity, validQuantity, max, unitsCount, issue };
  });
  const branchAvailable = catalog?.branches.some((branch) => branch.name === form.branch);
  const totalUnits = selectedItems.reduce((sum, row) => sum + (row.product ? row.unitsCount : 0), 0);

  function edit(update: UpdateForm) {
    setError("");
    onChange(update);
  }

  function editItem(productId: string, change: Partial<Pick<DraftItem, "quantity" | "measure">>) {
    edit((current) => ({ ...current, items: current.items.map((item) => item.productId === productId ? { ...item, ...change } : item) }));
  }

  function addProduct(product: Product) {
    const item: DraftItem = {
      productId: product.id,
      label: [product.name, product.capacity, product.color, product.code].filter(Boolean).join(" · "),
      measure: product.boxes > 0 ? "BOXES" : "UNITS",
      quantity: "1",
    };
    edit((current) => current.items.some((choice) => choice.productId === product.id)
      ? current
      : { ...current, items: [...current.items, item] });
    productSearch.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !catalog) return;
    if (!branchAvailable) {
      setError("Selecciona una sucursal activa.");
      return;
    }
    if (!selectedItems.length) {
      setError("Añade al menos un producto.");
      return;
    }
    if (selectedItems.some((row) => !row.validQuantity || row.issue)) {
      setError("Revisa la cantidad y la disponibilidad de todos los productos añadidos.");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const reason = form.reason.trim();
      const result = await createWarehouseRequestAction({
        title: reason || `Solicitud de ${isExit ? "salida" : "entrada"}`,
        branch: form.branch,
        type: form.type,
        details: reason || null,
        status: "PENDING",
        items: selectedItems.map(({ item, unitsCount, quantity }) => ({ productId: item.productId, measure: item.measure, quantity, unitsCount })),
      });
      if (result.success && result.data) onSent(result.data.requestCode);
      else setError(result.error ?? "No se pudo enviar la solicitud.");
    } catch {
      setError("No se pudo confirmar el envío. Verifica el historial antes de volver a intentarlo.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <form aria-labelledby="warehouse-request-title" noValidate onSubmit={submit} onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
    }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-6">
        <h1 ref={heading} tabIndex={-1} id="warehouse-request-title" className="text-xl font-bold tracking-tight text-slate-900 focus:outline-none">Solicitud de movimiento</h1>
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}><ArrowLeft />Volver a solicitudes</Button>
      </div>

      <fieldset disabled={saving} className="min-w-0">
        <div className="grid gap-4 border-b border-slate-200 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_1fr_2fr]">
          <label className="block text-sm font-semibold text-slate-800">
            Tipo de movimiento
            <select value={form.type} onChange={(event) => edit((current) => ({ ...current, type: event.target.value as WarehouseRequestFormData["type"] }))} className={`mt-1.5 ${selectStyle}`}>
              <option value="EXIT">Salida</option>
              <option value="ENTRY">Entrada</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Sucursal
            <select value={form.branch} aria-required="true" onChange={(event) => edit((current) => ({ ...current, branch: event.target.value }))} className={`mt-1.5 ${selectStyle}`}>
              <option value="">Selecciona una sucursal</option>
              {form.branch && !branchAvailable && <option value={form.branch} disabled>{form.branch}{catalog ? " (inactiva)" : ""}</option>}
              {catalog?.branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-800 sm:col-span-2 lg:col-span-1">
            Motivo o referencia <span className="font-normal text-slate-500">(opcional)</span>
            <Input className="mt-1.5 placeholder:text-slate-500" value={form.reason} onChange={(event) => edit((current) => ({ ...current, reason: event.target.value }))} placeholder="Ej. Reposición de inventario" />
          </label>
        </div>

        <div className="grid min-w-0 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="min-w-0 px-4 py-5 sm:px-6" aria-labelledby="warehouse-product-search-title">
            <h2 id="warehouse-product-search-title" className="mb-2 text-sm font-bold text-slate-900">Añadir productos</h2>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-slate-500" />
              <Input ref={productSearch} type="search" aria-label="Buscar productos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, modelo, color o capacidad" className="pl-9 placeholder:text-slate-500" />
            </div>
            {options === "error" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-rose-800" role="alert">
                No se pudieron cargar los productos y sucursales.
                <Button type="button" size="sm" variant="outline" onClick={() => { setOptions(null); setAttempt((current) => current + 1); }}>Reintentar</Button>
              </div>
            ) : !catalog ? (
              <p role="status" className="py-5 text-sm text-slate-600">Cargando productos y sucursales…</p>
            ) : matches.length === 0 ? (
              <p className="py-5 text-sm text-slate-600">{query.trim() ? "No se encontraron productos para esta búsqueda." : "No hay más productos para añadir."}</p>
            ) : (
              <ul aria-label="Productos disponibles" className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto lg:max-h-96">
                {matches.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="wrap-break-word text-sm font-semibold text-slate-900">{[product.brand, product.name].filter(Boolean).join(" · ")}</p>
                      <p className="mt-0.5 wrap-break-word text-xs text-slate-600">{[product.code, product.capacity, product.color].filter(Boolean).join(" · ")}</p>
                      {isExit && <p className="mt-0.5 text-xs text-slate-600">{unitFormat.format(product.totalUnits)} uds disponibles</p>}
                    </div>
                    <Button type="button" variant="secondary" className="min-h-11 shrink-0" aria-label={`Añadir ${product.name} (${product.code})`} onClick={() => addProduct(product)}><Plus />Añadir</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-w-0 bg-slate-50 px-4 py-5 sm:px-6" aria-labelledby="warehouse-selected-products-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="warehouse-selected-products-title" className="text-sm font-bold text-slate-900">Productos añadidos ({selectedItems.length})</h2>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">Total: {unitFormat.format(totalUnits)} uds</p>
            </div>
            {selectedItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Añade un producto del catálogo para indicar su presentación y cantidad.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200">
                {selectedItems.map(({ item, product, max, unitsCount, issue }) => (
                  <li key={item.productId} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pt-1">
                        <p className="wrap-break-word text-sm font-semibold text-slate-900">{product?.name ?? item.label}</p>
                        {product && <p className="mt-0.5 wrap-break-word text-xs text-slate-600">{[product.code, product.capacity, product.color].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 hover:bg-rose-50 hover:text-rose-700" aria-label={`Quitar ${product?.name ?? item.label}`} onClick={() => edit((current) => ({ ...current, items: current.items.filter((choice) => choice.productId !== item.productId) }))}><X /></Button>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Presentación
                        <select className={`mt-1 ${selectStyle}`} aria-label={`Presentación de ${product?.name ?? item.label}`} value={item.measure} onChange={(event) => editItem(item.productId, { measure: event.target.value as DraftItem["measure"] })}>
                          <option value="BOXES">Cajas</option>
                          <option value="UNITS">Unidades sueltas</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-700">
                        Cantidad
                        <Input className="mt-1 tabular-nums" aria-label={`Cantidad de ${product?.name ?? item.label}`} aria-invalid={!!issue || undefined} aria-describedby={`warehouse-quantity-${item.productId}`} type="number" inputMode="numeric" min={1} max={max} step={1} value={item.quantity} onChange={(event) => editItem(item.productId, { quantity: event.target.value })} />
                      </label>
                    </div>
                    <p id={`warehouse-quantity-${item.productId}`} className={`mt-1.5 text-xs ${issue ? "font-medium text-rose-700" : "text-slate-600"}`}>
                      {issue ?? `${unitFormat.format(unitsCount)} uds solicitadas${max !== undefined ? ` · ${unitFormat.format(max)} ${item.measure === "BOXES" ? "cajas disponibles" : "unidades disponibles"}` : ""}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-slate-200 px-4 py-4 sm:px-6">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className={`flex items-center gap-2 text-sm ${storageError ? "text-rose-800" : "text-slate-600"}`}>
            {saved && !storageError ? <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700" /> : <FilePenLine aria-hidden="true" className="size-4 shrink-0" />}
            {storageError ? "El navegador no pudo guardar el borrador. Conserva esta página abierta."
              : saved ? "Borrador guardado en este navegador"
              : "Los cambios se guardan automáticamente"}
          </p>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || !catalog}>
            <Send />{saving ? "Enviando solicitud…" : "Enviar solicitud"}
          </Button>
        </div>
      </div>
    </form>
  );
}
