"use client";

import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Mail, Pencil, Phone, Plus, Search, Truck, X } from "lucide-react";
import { deactivateQcSupplierAction, saveQcSupplierAction } from "../actions/qc-supplier";

export interface QcSupplierView {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

export function QcSuppliersManager({
  initialSuppliers,
  databaseReady,
}: {
  initialSuppliers: QcSupplierView[];
  databaseReady: boolean;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactName, supplier.phone, supplier.email]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [query, suppliers]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(supplier: QcSupplierView) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      notes: supplier.notes ?? "",
      status: supplier.status,
    });
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await saveQcSupplierAction({ id: editingId ?? undefined, ...form });
    if (!result.success) {
      setError(result.error);
      setSaving(false);
      return;
    }
    const saved: QcSupplierView = result.data;
    setSuppliers((current) =>
      editingId
        ? current.map((supplier) => supplier.id === saved.id ? saved : supplier)
        : [saved, ...current],
    );
    setOpen(false);
    setSaving(false);
  }

  async function deactivate(supplier: QcSupplierView) {
    if (!window.confirm(`¿Desactivar a ${supplier.name}? Ya no aparecerá para compras nuevas.`)) return;
    const result = await deactivateQcSupplierAction(supplier.id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuppliers((current) => current.map((item) => item.id === supplier.id ? result.data : item));
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-700">
            <Truck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Proveedores de control de calidad</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Catálogo exclusivo para las compras y recepciones que alimentan el flujo de QC. No se mezcla con proveedores generales.
            </p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="focus-ring flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Agregar proveedor QC
        </button>
      </section>

      {!databaseReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-bold">Vista previa sin base de datos</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Puedes revisar el diseño y abrir el formulario. Los proveedores se podrán guardar después de aplicar la migración preparada.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proveedor, contacto, teléfono o correo..." className="focus-ring h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs text-slate-800 outline-none" />
        </div>
      </section>

      {error && !open ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}

      {filtered.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">No hay proveedores QC registrados</p>
          <p className="mt-1 text-xs text-slate-500">Agrégalos aquí para seleccionarlos posteriormente desde Compras y Control de Calidad.</p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier) => (
            <article key={supplier.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{supplier.name}</h2>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${supplier.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                    {supplier.status === "ACTIVE" ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
                <button type="button" onClick={() => openEdit(supplier)} className="focus-ring rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-violet-700" aria-label={`Editar ${supplier.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                {supplier.contactName ? <p className="font-semibold text-slate-700">Contacto: {supplier.contactName}</p> : null}
                {supplier.phone ? <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-violet-600" />{supplier.phone}</p> : null}
                {supplier.email ? <p className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5 text-violet-600" />{supplier.email}</p> : null}
                {supplier.notes ? <p className="border-t border-slate-100 pt-2 leading-5 text-slate-500">{supplier.notes}</p> : null}
              </div>
              {supplier.status === "ACTIVE" ? (
                <button type="button" onClick={() => deactivate(supplier)} className="focus-ring mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                  Desactivar
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="qc-supplier-dialog-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 id="qc-supplier-dialog-title" className="text-base font-bold text-slate-900">{editingId ? "Editar proveedor QC" : "Nuevo proveedor QC"}</h2>
                <p className="mt-1 text-xs text-slate-500">Este registro se usará únicamente en Compras y QC.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="space-y-4 p-6">
              {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
              <label className="block text-xs font-semibold text-slate-700">Nombre del proveedor <span className="text-red-500">*</span><input required minLength={2} maxLength={160} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" /></label>
              <label className="block text-xs font-semibold text-slate-700">Persona de contacto<input maxLength={160} value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Teléfono<input maxLength={40} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" /></label>
                <label className="block text-xs font-semibold text-slate-700">Correo<input type="email" maxLength={200} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" /></label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">Notas<textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="focus-ring mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none" /></label>
              {editingId ? <label className="block text-xs font-semibold text-slate-700">Estado<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "ACTIVE" | "INACTIVE" }))} className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label> : null}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="focus-ring flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{saving ? "Guardando..." : "Guardar proveedor"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
