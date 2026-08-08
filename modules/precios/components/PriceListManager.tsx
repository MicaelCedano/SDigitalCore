"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Award, CalendarDays, Download, GripVertical, Headphones,
  Image as ImageIcon, ListPlus, Loader2, Pencil, Plus, Search, Settings2,
  ShieldCheck, Smartphone, Trash2, Upload, X,
} from "lucide-react";
import {
  deletePriceListBrandAction, deletePriceListItemAction, getPriceListWorkspaceAction,
  reorderPriceListBrandsAction, savePriceListBrandAction, savePriceListItemAction,
  savePriceListLogoAction, setActivePriceListAction,
} from "../actions/price-list";
import type { PriceListItemInput } from "@/lib/validation/price-list";

type Item = PriceListItemInput & { id: string; createdAt?: string | Date; updatedAt?: string | Date };
type Brand = { id: string; name: string; color: string; orderIndex: number };
type Workspace = { inventory: Item[]; activeList: Item[]; brands: Brand[]; logo: string | null };

const PREVIEW_WIDTH = 1080;

const money = (value: unknown) => `RD$ ${Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
const syncActive = (active: Item[], inventory: Item[]) => {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  return active.map((item) => byId.get(item.id) || item).filter((item) => item.status !== "INACTIVE");
};

export function PriceListManager() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [activeList, setActiveList] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [draggedBrand, setDraggedBrand] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ brand: "", model: "", specs: "", price: "", cost: "0", wholesale: "0" });
  const [brandForm, setBrandForm] = useState({ name: "", color: "#111827" });
  const previewRef = useRef<HTMLDivElement>(null);
  const workspaceHydrated = useRef(false);

  const loadWorkspace = async () => {
    setLoading(true);
    const result = await getPriceListWorkspaceAction();
    if (result.success && result.data) {
      setInventory(result.data.inventory as Item[]);
      setActiveList(result.data.activeList as Item[]);
      setBrands(result.data.brands as Brand[]);
      setLogo(result.data.logo);
      workspaceHydrated.current = true;
    } else setMessage(result.error || "No se pudo cargar la lista");
    setLoading(false);
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (loading || !workspaceHydrated.current) return;
    const timer = setTimeout(async () => {
      const result = await setActivePriceListAction(activeList.map((item) => item.id));
      if (!result.success) setMessage(result.error || "No se pudo sincronizar la lista activa");
    }, 900);
    return () => clearTimeout(timer);
  }, [activeList, inventory, loading]);

  useEffect(() => {
    if (loading || !workspaceHydrated.current) return;
    const timer = setTimeout(async () => { await savePriceListLogoAction(logo); }, 1200);
    return () => clearTimeout(timer);
  }, [logo, loading]);

  const orderedBrands = useMemo(() => [...brands].sort((a, b) => a.orderIndex - b.orderIndex), [brands]);
  const filteredInventory = useMemo(() => {
    const term = inventorySearch.toLowerCase();
    return inventory.filter((item) => [item.brand, item.model, item.capacity, item.sku].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [inventory, inventorySearch]);
  const filteredActive = useMemo(() => activeList.filter((item) => [item.brand, item.model, item.capacity].some((v) => String(v || "").toLowerCase().includes(activeSearch.toLowerCase()))), [activeList, activeSearch]);
  const activeIds = new Set(activeList.map((item) => item.id));
  const grouped = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of activeList) groups.set(item.brand || "SIN MARCA", [...(groups.get(item.brand || "SIN MARCA") || []), item]);
    for (const list of groups.values()) list.sort((a, b) => Number(a.retailPrice) - Number(b.retailPrice));
    const result = orderedBrands.map((brand) => ({ brand, items: groups.get(brand.name) || [] })).filter((group) => group.items.length).concat(
      [...groups.entries()].filter(([name]) => !orderedBrands.some((brand) => brand.name === name)).map(([name, items]) => ({ brand: { id: name, name, color: "#111827", orderIndex: 999 }, items }))
    );
    return result.sort((a, b) => b.items.length - a.items.length || a.brand.orderIndex - b.brand.orderIndex);
  }, [activeList, orderedBrands]);
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, typeof grouped>();
    for (const group of grouped) {
      const category = group.items[0]?.category || "Celulares";
      groups.set(category, [...(groups.get(category) || []), group]);
    }
    return [...groups.entries()];
  }, [grouped]);

  useEffect(() => {
    const preview = previewRef.current;
    const viewport = preview?.parentElement;
    if (!viewport || !preview) return;

    const updatePreviewSize = () => {
      const availableWidth = Math.max(viewport.clientWidth - 32, 320);
      const nextScale = Math.min(1, availableWidth / PREVIEW_WIDTH);
      preview.style.zoom = String(nextScale);
    };

    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(viewport);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [grouped, logo]);

  useEffect(() => {
    if (!showBrandModal) return;
    const modal = document.querySelector<HTMLElement>("div.fixed.inset-0.z-50");
    const panel = modal?.firstElementChild as HTMLElement | null;
    const header = panel?.firstElementChild as HTMLElement | null;
    if (!modal || !panel) return;

    modal.style.alignItems = "flex-start";
    panel.style.maxHeight = "calc(100vh - 2rem)";
    panel.style.overflowY = "auto";
    panel.style.marginTop = "1rem";
    panel.style.marginBottom = "1rem";
    if (header) {
      header.style.position = "sticky";
      header.style.top = "-1.5rem";
      header.style.zIndex = "1";
      header.style.paddingTop = "1.5rem";
      header.style.backgroundColor = "white";
    }
  }, [showBrandModal]);

  const openCreate = () => {
    setEditing(null); setForm({ brand: orderedBrands[0]?.name || "", model: "", specs: "", price: "", cost: "0", wholesale: "0" }); setMessage(""); setShowItemModal(true);
  };
  const openEdit = (item: Item) => {
    setEditing(item); setForm({ brand: item.brand || "", model: item.model || "", specs: item.capacity || "", price: String(item.retailPrice || ""), cost: String(item.costPrice || 0), wholesale: String(item.wholesalePrice || 0) }); setMessage(""); setShowItemModal(true);
  };
  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.brand || !form.model || !form.price) { setMessage("Completa marca, modelo y precio público."); return; }
    setSaving(true);
    const payload: PriceListItemInput = { id: editing?.id, brand: form.brand, model: form.model, capacity: form.specs, retailPrice: Number(form.price.replace(/[^\d.]/g, "")), costPrice: Number(form.cost) || 0, wholesalePrice: Number(form.wholesale) || 0, category: "Celulares", isActive: editing ? activeIds.has(editing.id) : true, sortOrder: activeList.length, status: "ACTIVE" };
    const result = await savePriceListItemAction(payload);
    if (result.success && result.data) {
      const item = result.data as Item;
      setInventory((current) => [...current.filter((old) => old.id !== item.id), item]);
      setActiveList((current) => editing ? syncActive(current, [...inventory.filter((old) => old.id !== item.id), item]) : [...current, item]);
      setShowItemModal(false); setMessage("Producto guardado.");
    } else setMessage(result.error || "No se pudo guardar el producto");
    setSaving(false);
  };
  const toggleActive = (item: Item) => setActiveList((current) => activeIds.has(item.id) ? current.filter((old) => old.id !== item.id) : [...current, item]);
  const removeItem = async (item: Item) => {
    if (!confirm(`¿Archivar ${item.model}?`)) return;
    const result = await deletePriceListItemAction(item.id);
    if (result.success) { setInventory((current) => current.filter((old) => old.id !== item.id)); setActiveList((current) => current.filter((old) => old.id !== item.id)); }
    else setMessage(result.error || "No se pudo archivar el producto");
  };
  const addBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await savePriceListBrandAction(brandForm);
    if (result.success && result.data) { setBrands((current) => [...current, result.data as Brand]); setBrandForm({ name: "", color: "#111827" }); }
    else setMessage(result.error || "No se pudo crear la marca");
  };
  const reorderBrand = async (from: number, to: number) => {
    if (to < 0 || to >= brands.length) return;
    const next = [...orderedBrands]; [next[from], next[to]] = [next[to], next[from]]; setBrands(next.map((brand, index) => ({ ...brand, orderIndex: index })));
    await reorderPriceListBrandsAction(next.map((brand) => brand.id));
  };
  const deleteBrand = async (brand: Brand) => {
    if (!confirm(`¿Archivar la marca ${brand.name} y sus productos?`)) return;
    const result = await deletePriceListBrandAction(brand.id);
    if (result.success) { setBrands((current) => current.filter((item) => item.id !== brand.id)); setInventory((current) => current.filter((item) => item.brand !== brand.name)); setActiveList((current) => current.filter((item) => item.brand !== brand.name)); }
    else setMessage(result.error || "No se pudo archivar la marca");
  };
  const handleLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage("El logo no puede superar 2 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setLogo(String(reader.result)); reader.readAsDataURL(file);
  };
  const exportImage = async () => {
    const preview = previewRef.current;
    if (!preview) return;
    setExporting(true);
    const previousZoom = preview.style.zoom;
    preview.dataset.exportPreview = "true";
    try {
      preview.style.zoom = "1";
      const canvas = await html2canvas(preview, {
        scale: 1,
        backgroundColor: "#fff",
        useCORS: true,
        imageTimeout: 15000,
        windowWidth: PREVIEW_WIDTH,
        onclone: (clonedDocument) => {
          const clonedPreview = clonedDocument.querySelector<HTMLElement>("[data-export-preview]");
          if (!clonedPreview) return;
          const elements = [clonedPreview, ...Array.from(clonedPreview.querySelectorAll<HTMLElement>("*"))];
          for (const element of elements) {
            const styles = clonedDocument.defaultView?.getComputedStyle(element);
            if (!styles) continue;
            for (let index = 0; index < styles.length; index += 1) {
              const property = styles.item(index);
              if (property.startsWith("--")) continue;
              const value = styles.getPropertyValue(property);
              if (/(?:lab|lch|oklab|oklch)\(/i.test(value)) continue;
              element.style.setProperty(property, value);
            }
          }
          clonedDocument.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => node.remove());
        },
      });
      const link = document.createElement("a"); link.download = `lista-precios-${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL("image/png"); link.click();
    } catch (error) {
      console.error("[price-list] Error al exportar PNG", error);
      setMessage("No se pudo generar la imagen. Intenta nuevamente.");
    } finally {
      preview.style.zoom = previousZoom;
      delete preview.dataset.exportPreview;
      setExporting(false);
    }
  };

  return <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div><h1 className="text-2xl font-black tracking-tight text-slate-900">Lista de Precios SDigital</h1><p className="mt-1 text-sm text-slate-500">Inventario, lista activa y publicación de precios en una sola pantalla.</p></div>
      <div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"><Upload className="mr-2 inline h-4 w-4" />Logo<input type="file" accept="image/*" onChange={handleLogo} className="hidden" /></label><button onClick={() => setShowBrandModal(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><Settings2 className="mr-2 inline h-4 w-4" />Marcas</button><button onClick={exportImage} disabled={exporting || !activeList.length} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{exporting ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Download className="mr-2 inline h-4 w-4" />}Exportar PNG</button><button onClick={openCreate} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"><Plus className="mr-2 inline h-4 w-4" />Agregar producto</button></div>
    </header>
    {message && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">{message}</div>}
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-900">Inventario de productos</h2><p className="text-xs text-slate-500">Edita el catálogo y agrega productos a la publicación activa.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Buscar marca o modelo" className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" /></div></div><div className="max-h-[520px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={3} className="p-10 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : filteredInventory.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-black text-slate-900">{item.brand || "Sin marca"} · {item.model}</div><div className="text-xs text-slate-500">{item.capacity || "Sin especificación"}</div></td><td className="px-4 py-3 font-bold text-indigo-700">{money(item.retailPrice)}</td><td className="px-4 py-3 text-right"><button onClick={() => toggleActive(item)} className={`mr-1 rounded-lg px-2 py-1 text-xs font-bold ${activeIds.has(item.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{activeIds.has(item.id) ? "En lista" : "Agregar"}</button><button onClick={() => openEdit(item)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button onClick={() => void removeItem(item)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table>{!loading && !filteredInventory.length && <div className="p-10 text-center text-sm text-slate-500">No hay productos que coincidan.</div>}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-900">Lista activa</h2><p className="text-xs text-slate-500">Esta es la selección que aparecerá en el PNG.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={activeSearch} onChange={(event) => setActiveSearch(event.target.value)} placeholder="Filtrar lista activa" className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" /></div></div><div className="max-h-[380px] overflow-auto p-3">{filteredActive.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-slate-100 px-2 py-3 last:border-0"><div><div className="font-black text-slate-900">{item.brand} · {item.model}</div><div className="text-xs text-slate-500">{item.capacity} · {money(item.retailPrice)}</div></div><button onClick={() => toggleActive(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4" /></button></div>)}{!filteredActive.length && <div className="p-8 text-center text-sm text-slate-500">Agrega productos desde el inventario.</div>}</div></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 bg-white p-4"><div><h2 className="font-black text-slate-900">Vista previa HD</h2><p className="text-xs text-slate-500">1080 px · formato catálogo listo para publicar</p></div><ListPlus className="h-5 w-5 text-red-600" /></div><div className="max-h-[880px] overflow-auto p-4"><div ref={previewRef} className="mx-auto w-[1080px] bg-white text-black shadow-xl" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div className="flex min-h-[170px] items-center gap-8 border-b border-slate-100 px-10 py-5"><div className="flex h-32 w-40 shrink-0 items-center justify-center">{logo ? <img src={logo} alt="Logo de SDigital" className="max-h-full max-w-full object-contain" /> : <div className="flex h-full w-full flex-col items-center justify-center text-red-700"><ImageIcon className="h-12 w-12" /><span className="mt-2 text-sm font-black tracking-widest">SEÑAL DIGITAL</span></div>}</div><div className="min-w-0 flex-1"><h3 className="text-[58px] font-black leading-none tracking-[-0.06em] text-black">LISTA DE <span className="text-red-700">PRECIOS</span></h3><p className="mt-3 text-[22px] font-bold text-slate-600">✓ Los mejores equipos, al <span className="text-red-700">mejor precio</span></p></div><div className="flex items-center gap-3 rounded-xl bg-red-700 px-5 py-4 text-white"><CalendarDays className="h-9 w-9" /><div><div className="text-sm font-bold uppercase">Actualizado:</div><div className="text-lg font-black">{new Date().toLocaleDateString("es-DO")}</div></div></div></div>
        {groupedByCategory.map(([category, categoryGroups]) => <div key={category} className="border-b border-slate-200"><div className="flex items-center justify-center gap-3 bg-red-700 px-6 py-2 text-[28px] font-black uppercase tracking-wide text-white"><Smartphone className="h-8 w-8" />{category}</div><div className="grid grid-cols-4">{categoryGroups.map(({ brand, items }) => <div key={brand.id} className="min-h-[190px] border-b border-r border-slate-200 p-3 last:border-r-0"><div className="mb-2 border-b-2 px-1 pb-1 text-[23px] font-black uppercase" style={{ color: brand.color, borderColor: brand.color }}>{brand.name}</div><div>{items.map((item) => <div key={item.id} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0"><span className="min-w-0 text-[16px] font-black leading-tight">{item.model} <small className="font-medium text-slate-600">{item.capacity}</small></span><span className="whitespace-nowrap text-[20px] font-black" style={{ color: brand.color }}>{money(item.retailPrice)}</span></div>)}</div></div>)}</div></div>)}
        {!activeList.length && <div className="p-20 text-center text-3xl italic text-slate-300">Lista de precios vacía</div>}
        <div className="grid grid-cols-3 gap-3 bg-white px-3 py-3"><div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"><ShieldCheck className="h-10 w-10 shrink-0 text-red-700" /><div><div className="font-black">GARANTÍA</div><div className="text-sm text-slate-600">En todos nuestros productos</div></div></div><div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"><Award className="h-10 w-10 shrink-0 text-red-700" /><div><div className="font-black">PRODUCTOS 100% ORIGINALES</div><div className="text-sm text-slate-600">Calidad garantizada</div></div></div><div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"><Headphones className="h-10 w-10 shrink-0 text-red-700" /><div><div className="font-black">SOPORTE Y ASESORÍA</div><div className="text-sm text-slate-600">Estamos para ayudarte</div></div></div></div>
        <div className="flex items-center justify-between bg-red-700 px-8 py-3 text-base font-bold text-white"><span>Contáctanos por WhatsApp</span><span>Precios sujetos a disponibilidad sin previo aviso.</span><span>Gracias por elegir Señal Digital ♥</span></div>
      </div></div></section>
    </div>
    {showItemModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={saveItem} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-black text-slate-900">{editing ? "Editar producto" : "Agregar producto"}</h2><p className="text-xs text-slate-500">Los cambios actualizan inventario y lista activa.</p></div><button type="button" onClick={() => setShowItemModal(false)}><X /></button></div><div className="grid gap-4 sm:grid-cols-2">{[["Marca", "brand"], ["Modelo", "model"], ["Especificación", "specs"], ["Precio público", "price"], ["Precio costo", "cost"], ["Precio mayorista", "wholesale"]].map(([label, key]) => <label key={key} className="text-xs font-bold text-slate-700">{label}<input required={key === "brand" || key === "model" || key === "price"} type={key === "price" || key === "cost" || key === "wholesale" ? "number" : "text"} value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></label>)}</div>{message && <p className="mt-4 text-sm font-semibold text-red-600">{message}</p>}<button disabled={saving} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar producto"}</button></form></div>}
    {showBrandModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">Marcas y orden de publicación</h2><p className="text-xs text-slate-500">Arrastra para cambiar el orden de la vista previa.</p></div><button onClick={() => setShowBrandModal(false)}><X /></button></div><form onSubmit={addBrand} className="mb-5 flex gap-2"><input required value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} placeholder="Nueva marca" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" /><input type="color" value={brandForm.color} onChange={(event) => setBrandForm({ ...brandForm, color: event.target.value })} className="h-10 w-12 rounded-lg border border-slate-200" /><button className="rounded-xl bg-indigo-600 px-3 text-xs font-black text-white"><Plus className="inline h-4 w-4" /></button></form><div className="space-y-2">{orderedBrands.map((brand, index) => <div key={brand.id} draggable onDragStart={() => setDraggedBrand(brand.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { const from = orderedBrands.findIndex((item) => item.id === draggedBrand); void reorderBrand(from, index); setDraggedBrand(null); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"><GripVertical className="h-4 w-4 cursor-grab text-slate-400" /><span style={{ backgroundColor: brand.color }} className="h-4 w-4 rounded-full" /><span className="flex-1 text-sm font-bold text-slate-800">{brand.name}</span><button onClick={() => void reorderBrand(index, index - 1)} className="px-2 text-slate-500">↑</button><button onClick={() => void reorderBrand(index, index + 1)} className="px-2 text-slate-500">↓</button><button onClick={() => void deleteBrand(brand)} className="p-1 text-red-500"><Trash2 className="h-4 w-4" /></button></div>)}</div></div></div>}
  </div>;
}
