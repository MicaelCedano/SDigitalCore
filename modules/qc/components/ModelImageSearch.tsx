"use client";

import { useState } from "react";
import { Search, Loader2, RefreshCw, ImageOff } from "lucide-react";
import { searchModelImageAction } from "../actions/model-image";

interface ModelImageSearchProps {
  brand?: string | null;
  model?: string | null;
  color?: string | null;
}

type ImageResult = { url: string; thumbnail: string };

/**
 * Busca en internet una imagen de referencia del modelo (Bing Images) para
 * comparar el equipo físico durante la revisión — fórmula de SDigitalSystem.
 */
export function ModelImageSearch({ brand, model, color }: ModelImageSearchProps) {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    const res = await searchModelImageAction({ brand, model, color });
    setLoading(false);
    if (res.success && res.data.length > 0) {
      setImages(res.data);
      setSelected(res.data[0].url);
    } else {
      setError(res.error || "No se encontraron imágenes del modelo.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#5750f1]" />
          Imagen de referencia del modelo
        </p>
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#5750f1] bg-[#5750f1]/10 border border-[#5750f1]/20 hover:bg-[#5750f1]/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {images.length > 0 ? "Buscar otra" : "Buscar imagen"}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
          <ImageOff className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {selected && (
        <div className="h-48 rounded-xl border border-slate-200 bg-white p-2 flex items-center justify-center overflow-hidden">
          {/* Imagen externa (Bing) — misma técnica que SDigitalSystem */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected}
            alt={`${brand || ""} ${model || ""}`}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>
      )}

      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {images.map((img) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setSelected(img.url)}
              title="Ver esta imagen"
              className={`w-14 h-14 shrink-0 rounded-lg border-2 overflow-hidden transition-all ${
                selected === img.url ? "border-[#5750f1] ring-2 ring-[#5750f1]/20" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbnail} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
