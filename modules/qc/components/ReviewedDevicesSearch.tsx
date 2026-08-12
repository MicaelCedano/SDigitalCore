"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface ReviewedDevicesSearchProps {
  initial: { query: string; result: string };
}

/**
 * Búsqueda en vivo: al escribir (debounce 350ms) o cambiar el filtro de
 * resultado, actualiza la URL y el servidor re-renderiza la tabla.
 * Reemplaza el <form method="get"> que obligaba a presionar Filtrar.
 */
export function ReviewedDevicesSearch({ initial }: ReviewedDevicesSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initial.query);
  const [result, setResult] = useState(initial.result);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza el input cuando el servidor re-renderiza (paginación, limpiar filtros).
  useEffect(() => {
    setQuery(initial.query);
  }, [initial.query]);
  useEffect(() => {
    setResult(initial.result);
  }, [initial.result]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const push = (nextQuery: string, nextResult: string) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextResult && nextResult !== "ALL") params.set("result", nextResult);
    const qs = params.toString();
    router.replace(`/qc/equipos-revisados${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push(value, result), 350);
  };

  const onResultChange = (value: string) => {
    setResult(value);
    push(query, value);
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[#eaecf0] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <label className="relative block w-full sm:max-w-md">
        <span className="sr-only">Buscar equipos revisados</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={120}
          placeholder="Buscar IMEI, serie, modelo o QC..."
          className="focus-ring h-10 w-full rounded-lg border border-[#d0d5dd] bg-white pl-10 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98a2b3]"
        />
      </label>
      <select
        value={result}
        onChange={(e) => onResultChange(e.target.value)}
        aria-label="Filtrar por resultado"
        className="focus-ring h-10 min-w-40 rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#344054] outline-none"
      >
        <option value="ALL">Todos los resultados</option>
        <option value="FUNCTIONAL">Funcionales</option>
        <option value="NON_FUNCTIONAL">No funcionales</option>
        <option value="UNSPECIFIED">Sin clasificación</option>
      </select>
    </div>
  );
}
