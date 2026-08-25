"use client";

import { useState, useEffect } from "react";
import {
  getWarehouseProductsAction,
  createWarehouseProductAction,
  deleteWarehouseProductAction,
} from "../actions/warehouse";
import { WarehouseProductInput } from "@/lib/validation/warehouse";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Boxes,
  Layers,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  Cpu,
  Palette,
  Eye,
  EyeOff,
} from "lucide-react";

function getDisplayedTotalUnits(product: { boxes?: number | null; unitsPerBox?: number | null; looseUnits?: number | null }) {
  return (product.boxes || 0) * (product.unitsPerBox || 1) + (product.looseUnits || 0);
}

export function WarehouseProductsManager({ roleCode = "ADMIN" }: { roleCode?: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [boxes, setBoxes] = useState<number | string>("");
  const [unitsPerBox, setUnitsPerBox] = useState<number | string>("");
  const [looseUnits, setLooseUnits] = useState<number | string>("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await getWarehouseProductsAction(search);
    if (res.success && res.data) {
      setProducts(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setCode("");
    setName("");
    setBrand("");
    setColor("");
    setCapacity("");
    setDescription("");
    setBoxes("");
    setUnitsPerBox("");
    setLooseUnits("");
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (prod: any) => {
    setSelectedProduct(prod);
    setCode(prod.code || "");
    setName(prod.name || "");
    setBrand(prod.brand || "");
    setColor(prod.color || "");
    setCapacity(prod.capacity || "");
    setDescription(prod.description || "");
    setBoxes(prod.boxes ?? "");
    setUnitsPerBox(prod.unitsPerBox ?? "");
    setLooseUnits(prod.looseUnits ?? "");
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!code.trim()) {
      setErrorMsg("El código de producto es obligatorio.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("El nombre del producto es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const payload: WarehouseProductInput = {
        id: selectedProduct?.id,
        code: code.trim(),
        name: name.trim(),
        brand: brand.trim() || undefined,
        color: color.trim() || undefined,
        capacity: capacity.trim() || undefined,
        description: description.trim() || undefined,
        boxes: Number(boxes) || 0,
        unitsPerBox: Number(unitsPerBox) || 1,
        looseUnits: Number(looseUnits) || 0,
      };

      const res = await createWarehouseProductAction(payload);
      if (res.success) {
        setShowModal(false);
        fetchProducts();
      } else {
        setErrorMsg(res.error || "Ocurrió un error al guardar");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de eliminar este producto del almacén?")) {
      await deleteWarehouseProductAction(id);
      fetchProducts();
    }
  };

  const totalBoxes = products.reduce((acc, p) => acc + (p.boxes || 0), 0);
  const totalLooseUnits = products.reduce((acc, p) => acc + (p.looseUnits || 0), 0);
  const totalUnits = products.reduce((acc, p) => acc + getDisplayedTotalUnits(p), 0);
  const visibleProducts = showOutOfStock
    ? products
    : products.filter((p) => getDisplayedTotalUnits(p) > 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Almacén & Inventario General
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de productos por cajas, unidades sueltas, marcas y especificaciones de capacidad
            </p>
          </div>
        </div>

        {roleCode === "ADMIN" && <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Registrar Producto
        </button>}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Equipos sin caja</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {totalLooseUnits} <span className="text-xs font-semibold text-slate-500">uds</span>
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-600 font-medium block">Total Cajas en Stock</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {totalBoxes} <span className="text-xs font-semibold text-slate-500">cajas</span>
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5750f1] font-medium block">Unidades Totales Calculadas</span>
            <span className="text-2xl font-black text-[#5750f1] mt-1 block">
              {totalUnits} <span className="text-xs font-semibold text-slate-500">uds</span>
            </span>
          </div>
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:w-96 sm:flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, marca, color o capacidad..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOutOfStock((current) => !current)}
            className={showOutOfStock ? "px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border bg-[#5750f1]/10 text-[#5750f1] border-[#5750f1]/20" : "px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}
            aria-pressed={showOutOfStock}
            title={showOutOfStock ? "Ocultar productos sin stock" : "Mostrar productos sin stock"}
          >
            {showOutOfStock ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{showOutOfStock ? "Ocultar agotados" : "Ver agotados"}</span>
          </button>

          <button
            onClick={fetchProducts}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          title="Recargar inventario"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando productos de almacén...</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No hay productos en almacén</p>
            <p className="text-xs text-slate-500">
              Registra un nuevo producto para iniciar la gestión de cajas y unidades.
            </p>
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-slate-100">
            {visibleProducts.map((p) => {
              const displayedTotalUnits = getDisplayedTotalUnits(p);
              const isOutOfStock = displayedTotalUnits <= 0;

              return (
              <article key={p.id} className={`p-4 space-y-3 ${isOutOfStock ? "bg-red-50/70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-[#5750f1]">#{p.code}</span>
                    <h2 className={`mt-1 break-words text-base font-bold leading-tight ${isOutOfStock ? "text-red-800" : "text-slate-800"}`}>{p.name}</h2>
                    {p.brand && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-slate-500">
                        <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>Marca: {p.brand}</span>
                      </p>
                    )}
                  </div>
                  {roleCode === "ADMIN" && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => handleOpenEdit(p)} className="rounded-lg bg-slate-100 p-2 text-slate-700" title="Editar producto" aria-label={`Editar ${p.name}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => handleDelete(p.id, e)} className="rounded-lg bg-red-50 p-2 text-red-600" title="Eliminar producto" aria-label={`Eliminar ${p.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {(p.color || p.capacity || p.description) && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.color && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><Palette className="h-3.5 w-3.5 text-indigo-500" />{p.color}</span>}
                    {p.capacity && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><Cpu className="h-3.5 w-3.5 text-emerald-600" />{p.capacity}</span>}
                    {p.description && <p className="basis-full break-words text-xs text-slate-500">{p.description}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="block font-semibold text-amber-700">Cajas</span>
                    <strong className="mt-0.5 block text-sm text-amber-800">{p.boxes || 0}</strong>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 ${isOutOfStock ? "border-red-200 bg-red-100" : "border-indigo-200 bg-indigo-50"}`}>
                    <span className={`block font-semibold ${isOutOfStock ? "text-red-700" : "text-indigo-700"}`}>Total unidades</span>
                    <strong className={`mt-0.5 block text-sm ${isOutOfStock ? "text-red-700" : "text-[#5750f1]"}`}>{displayedTotalUnits}</strong>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                    <span className="block font-semibold">Por caja</span>
                    <strong className="mt-0.5 block text-sm text-slate-800">{p.unitsPerBox || 0} uds</strong>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                    <span className="block font-semibold">Sueltas</span>
                    <strong className="mt-0.5 block text-sm text-slate-800">{p.looseUnits || 0} uds</strong>
                  </div>
                </div>
              </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Producto / Nombre</th>
                  <th className="px-4 py-3">Especificaciones</th>
                  <th className="px-4 py-3 text-center">Cajas en Stock</th>
                  <th className="px-4 py-3 text-center">Uds por Caja</th>
                  <th className="px-4 py-3 text-center">Sin Caja</th>
                  <th className="px-4 py-3 text-center">Total Unidades</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProducts.map((p) => {
                  const displayedTotalUnits = getDisplayedTotalUnits(p);
                  const isOutOfStock = displayedTotalUnits <= 0;

                  return (
                  <tr key={p.id} className={`transition-colors ${isOutOfStock ? "bg-red-50/70 hover:bg-red-100/80" : "hover:bg-slate-50/80"}`}>
                    <td className={`px-4 py-3.5 font-mono font-bold ${isOutOfStock ? "text-red-700" : "text-[#5750f1]"}`}>
                      {p.code}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-800 block text-xs">{p.name}</span>
                      {p.brand && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                          <Tag className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold">Marca: {p.brand}</span>
                        </span>
                      )}
                      {p.description && (
                        <span className="text-[11px] text-slate-500 block truncate max-w-xs mt-0.5">
                          {p.description}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {p.color && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                            <Palette className="w-3 h-3 text-indigo-500" /> {p.color}
                          </span>
                        )}
                        {p.capacity && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-emerald-600" /> {p.capacity}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-black px-2.5 py-1 rounded-lg border ${isOutOfStock ? "text-red-700 bg-red-100 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
                        {p.boxes} cajas
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-600">
                      {p.unitsPerBox} uds/caja
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-600">
                      {p.looseUnits || 0} uds
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-extrabold px-2.5 py-1 rounded-lg border ${isOutOfStock ? "text-red-700 bg-red-100 border-red-200" : "text-[#5750f1] bg-[#5750f1]/10 border-[#5750f1]/20"}`}>
                        {displayedTotalUnits} uds
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
{roleCode === "ADMIN" && <>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="Editar producto"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(p.id, e)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">
                {selectedProduct ? "Editar Producto de Almacén" : "Nuevo Producto de Almacén"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código / SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ej. IP15PM-256-AZ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre del Producto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. iPhone 15 Pro Max"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#5750f1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ej. Apple"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Ej. Azul Titania"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidad</label>
                  <input
                    type="text"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Ej. 256GB"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cajas Iniciales
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-amber-700 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unidades por Caja
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unitsPerBox}
                    onChange={(e) => setUnitsPerBox(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-[#5750f1] focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Equipos sin caja</label>
                  <input
                    type="number"
                    min={0}
                    value={looseUnits}
                    onChange={(e) => setLooseUnits(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-emerald-700 focus:outline-none focus:border-[#5750f1]"
                  />
                </div>

                <div className="col-span-2 text-right pt-1 border-t border-slate-200 text-xs font-bold text-slate-700">
                  Total Unidades Calculadas:{" "}
                  <strong className="text-[#5750f1] text-sm">
                    {(Number(boxes) || 0) * (Number(unitsPerBox) || 1) + (Number(looseUnits) || 0)} uds
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles adicionales del producto..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#5750f1] hover:bg-[#463ec5] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-[#5750f1]/20 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
