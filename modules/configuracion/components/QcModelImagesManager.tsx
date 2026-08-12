"use client";

import { useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Search,
  Loader2,
  RefreshCw,
  Trash2,
  Smartphone,
  X,
  ImageOff,
  Check,
} from "lucide-react";
import { searchModelImageAction } from "@/modules/qc/actions/model-image";
import { saveModelImageAction, removeModelImageAction } from "../actions/qc-model-image";

interface QcModelItem {
  brand: string;
  model: string;
  deviceCount: number;
  imageUrl: string | null;
}

interface QcModelImagesManagerProps {
  initialItems: QcModelItem[];
  databaseReady: boolean;
}

type ImageResult = { url: string; thumbnail: string };

function titleCase(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "iphone") return "iPhone";
  if (lower.startsWith("iphone ")) return "iPhone " + lower.slice(7);
  if (lower === "ipad") return "iPad";
  if (lower.startsWith("ipad ")) return "iPad " + lower.slice(5);
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QcModelImagesManager({ initialItems, databaseReady }: QcModelImagesManagerProps) {
  const [items, setItems] = useState<QcModelItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [searchingFor, setSearchingFor] = useState<QcModelItem | null>(null);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.brand.toLowerCase().includes(q) || item.model.toLowerCase().includes(q)
    );
  }, [items, query]);

  const runSearch = async (item: QcModelItem) => {
    setLoading(true);
    setError(null);
    setResults([]);
    const res = await searchModelImageAction({ brand: item.brand, model: item.model });
    setLoading(false);
    if (res.success && res.data.length > 0) {
      setResults(res.data);
    } else {
      setError(res.error || "No se encontraron imágenes para este modelo.");
    }
  };

  const assignImage = async (imageUrl: string) => {
    if (!searchingFor) return;
    setLoading(true);
    setError(null);
    const res = await saveModelImageAction({
      brand: searchingFor.brand,
      model: searchingFor.model,
      imageUrl,
    });
    setLoading(false);
    if (res.success) {
      setItems((prev) =>
        prev.map((item) =>
          item.brand === searchingFor.brand && item.model === searchingFor.model
            ? { ...item, imageUrl }
            : item
        )
      );
      setSearchingFor(null);
      setResults([]);
    } else {
      setError(res.error || "No se pudo guardar la imagen.");
    }
  };

  const removeImage = async (item: QcModelItem) => {
    const res = await removeModelImageAction({ brand: item.brand, model: item.model });
    if (res.success) {
      setItems((prev) =>
        prev.map((i) =>
          i.brand === item.brand && i.model === item.model ? { ...i, imageUrl: null } : i
        )
      );
    } else {
      setError(res.error || "No se pudo quitar la imagen.");
    }
  };

  if (!databaseReady) {
    return (
      <div className="space-y-6 pb-10">
        <div className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-[#eaecf0] px-5 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                <ImageIcon size={24} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7f56d9]">Configuración</p>
                <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#101828]">Imágenes de QC</h1>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-[#475467]">
              La tabla <code className="rounded bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-xs text-[#b42318]">qc_model_image</code> aún no
              existe en la base de datos. Aplica la migración{" "}
              <code className="rounded bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-xs">prisma/migrations/20260812_add_qc_model_image.sql</code>{" "}
              en Supabase y recarga.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-[#eaecf0] px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <ImageIcon size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7f56d9]">Configuración</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#101828]">Imágenes de QC</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#667085]">
                Modelos registrados en el sistema con su imagen de referencia (se usa en el modal de revisión del QC).
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-3 py-1.5 text-xs font-semibold text-[#475467]">
            <Smartphone size={14} /> {items.length} modelos
          </span>
        </div>

        <div className="border-b border-[#eaecf0] p-4 sm:px-6">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">Buscar modelo</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(60);
              }}
              maxLength={80}
              placeholder="Buscar marca o modelo..."
              className="focus-ring h-10 w-full rounded-lg border border-[#d0d5dd] bg-white pl-10 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98a2b3]"
            />
          </label>
        </div>

        {error && !searchingFor && (
          <div className="border-b border-[#eaecf0] px-6 py-3 text-xs font-semibold text-red-600">{error}</div>
        )}

        {filtered.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2f4f7] text-[#667085]">
              <ImageOff size={22} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[#101828]">No hay modelos para mostrar</h2>
            <p className="mt-1 max-w-md text-sm text-[#667085]">
              {query ? "Prueba con otra búsqueda." : "Los modelos aparecerán aquí cuando haya equipos registrados."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.slice(0, visibleCount).map((item) => (
                <div
                  key={`${item.brand}|${item.model}`}
                  className="overflow-hidden rounded-xl border border-[#e4e7ec] bg-white shadow-sm"
                >
                  <div className="flex h-36 items-center justify-center overflow-hidden bg-[#f9fafb] p-2">
                    {item.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.imageUrl}
                        alt={`${titleCase(item.brand)} ${titleCase(item.model)}`}
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-[#98a2b3]">
                        <Smartphone size={28} />
                        <span className="text-[10px] font-semibold">Sin imagen</span>
                      </span>
                    )}
                  </div>
                  <div className="border-t border-[#eaecf0] p-3">
                    <p className="truncate text-sm font-bold text-[#101828]">
                      {titleCase(item.brand)} {titleCase(item.model)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#667085]">{item.deviceCount} equipo(s)</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchingFor(item);
                          setResults([]);
                          setError(null);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#344054] hover:bg-[#f9fafb] transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {item.imageUrl ? "Cambiar" : "Buscar imagen"}
                      </button>
                      {item.imageUrl && (
                        <button
                          type="button"
                          onClick={() => removeImage(item)}
                          title="Quitar imagen"
                          className="inline-flex items-center justify-center rounded-lg border border-[#fecdca] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#b42318] hover:bg-[#fef3f2] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="border-t border-[#eaecf0] px-6 py-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + 60)}
                  className="rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]"
                >
                  Mostrar más ({filtered.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {searchingFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setSearchingFor(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e4e7ec] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#eaecf0] flex items-center justify-between bg-[#fcfcfd]">
              <div>
                <h2 className="text-base font-bold tracking-tight text-[#101828]">
                  Imagen de {titleCase(searchingFor.brand)} {titleCase(searchingFor.model)}
                </h2>
                <p className="text-xs text-[#667085]">Elige una imagen de internet para guardarla como referencia.</p>
              </div>
              <button
                onClick={() => setSearchingFor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {results.length === 0 && !loading && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2f4f7] text-[#667085]">
                    <Search size={22} />
                  </span>
                  <p className="max-w-xs text-sm text-[#667085]">
                    Busca en internet una imagen de referencia para este modelo.
                  </p>
                  <button
                    type="button"
                    onClick={() => runSearch(searchingFor)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338ca]"
                  >
                    <Search className="w-4 h-4" /> Buscar en internet
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4f46e5]" />
                  <p className="text-xs text-[#667085]">Buscando imágenes...</p>
                </div>
              )}

              {results.length > 0 && !loading && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {results.map((img) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => assignImage(img.url)}
                        title="Usar esta imagen"
                        className="group relative aspect-square overflow-hidden rounded-xl border border-[#e4e7ec] bg-[#f9fafb] hover:border-[#4f46e5] transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-[#4f46e5]/0 text-white opacity-0 transition-all group-hover:bg-[#4f46e5]/60 group-hover:opacity-100">
                          <Check className="w-6 h-6" />
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => runSearch(searchingFor)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f46e5] hover:text-[#3730a3]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Buscar otras imágenes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
