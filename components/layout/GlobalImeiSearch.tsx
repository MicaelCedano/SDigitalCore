"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Barcode, FileText, LoaderCircle, PackageCheck, Search, ShieldCheck, X } from "lucide-react";

type GlobalImeiResult = {
  id: string;
  source: "warranty" | "receipt" | "stock-count" | "invoice";
  sourceLabel: string;
  documentNumber: string;
  imei: string;
  title: string;
  detail: string;
  status: string;
  date: string;
  href: string;
};

const sourceIcons = {
  warranty: ShieldCheck,
  receipt: PackageCheck,
  "stock-count": Barcode,
  invoice: FileText,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function GlobalImeiSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalImeiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const digits = query.replace(/\D/g, "").slice(0, 15);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (digits.length < 4) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search/imei?q=${encodeURIComponent(digits)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { results?: GlobalImeiResult[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo completar la búsqueda.");
        setResults(payload.results ?? []);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setResults([]);
        setError(requestError instanceof Error ? requestError.message : "No se pudo completar la búsqueda.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [digits]);

  function clearSearch() {
    setQuery("");
    setResults([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value.replace(/\D/g, "").slice(0, 15))}
          onFocus={() => setOpen(true)}
          inputMode="numeric"
          autoComplete="off"
          aria-label="Buscar IMEI en todos los módulos"
          aria-expanded={open}
          placeholder="Buscar IMEI global..."
          className="focus-ring h-10 w-56 rounded-[10px] border border-[#d0d5dd] bg-[#f8fafc] pl-9 pr-9 text-sm text-[#101828] outline-none transition focus:w-72 focus:border-[#818cf8] focus:bg-white lg:w-64"
        />
        {query ? (
          <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#98a2b3] hover:bg-[#eaecf0] hover:text-[#475467]">
            <X size={14} />
          </button>
        ) : (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#98a2b3]">Ctrl K</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="focus-ring flex h-10 w-10 items-center justify-center rounded-[10px] text-[#475467] hover:bg-[#f2f4f7] sm:hidden"
        aria-label="Buscar IMEI global"
        aria-expanded={open}
      >
        <Search size={20} strokeWidth={1.75} />
      </button>

      {open ? (
        <div role="dialog" aria-label="Resultados de búsqueda global de IMEI" className="animate-fade-in fixed inset-x-4 top-[76px] overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-[0_18px_44px_-12px_rgba(16,24,40,.24)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[430px]">
          <div className="border-b border-[#f0f1f3] p-3 sm:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value.replace(/\D/g, "").slice(0, 15))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Escribe al menos 4 dígitos"
                aria-label="IMEI a buscar"
                className="focus-ring h-10 w-full rounded-[10px] border border-[#d0d5dd] pl-9 pr-9 text-sm outline-none"
              />
              {query ? <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#98a2b3]"><X size={15} /></button> : null}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-[#f0f1f3] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#101828]">Rastreo global de IMEI</p>
              <p className="mt-0.5 text-xs text-[#667085]">Garantías, almacén, conteos y documentos.</p>
            </div>
            {digits.length >= 4 && !loading ? <span className="rounded-full bg-[#eef2ff] px-2 py-1 text-xs font-semibold text-[#4338ca]">{results.length} resultado{results.length === 1 ? "" : "s"}</span> : null}
          </div>

          <div className="max-h-[460px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#667085]"><LoaderCircle className="animate-spin" size={18} /> Buscando en los módulos autorizados...</div>
            ) : error ? (
              <div className="px-4 py-10 text-center text-sm text-[#b42318]">{error}</div>
            ) : digits.length < 4 ? (
              <div className="px-4 py-10 text-center">
                <Barcode className="mx-auto text-[#c7d7fe]" size={34} />
                <p className="mt-3 text-sm font-semibold text-[#344054]">Escribe al menos 4 dígitos</p>
                <p className="mt-1 text-xs text-[#667085]">Puedes usar los últimos dígitos del IMEI.</p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Search className="mx-auto text-[#d0d5dd]" size={32} />
                <p className="mt-3 text-sm font-semibold text-[#344054]">IMEI no encontrado</p>
                <p className="mt-1 text-xs text-[#667085]">No aparece en ningún módulo al que tienes acceso.</p>
              </div>
            ) : results.map((result) => {
              const Icon = sourceIcons[result.source];
              return (
                <Link key={result.id} href={result.href} onClick={() => setOpen(false)} className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[#f8fafc]">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4338ca]"><Icon size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#344054] group-hover:text-[#4338ca]">{result.title}</span>
                      <span className="shrink-0 text-[11px] text-[#98a2b3]">{formatDate(result.date)}</span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs font-semibold text-[#101828]">IMEI {result.imei}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#667085]">
                      <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5 font-medium text-[#475467]">{result.sourceLabel}</span>
                      <span>{result.documentNumber}</span><span>·</span><span className="rounded bg-[#fef3f2] px-1.5 py-0.5 font-medium text-[#b42318]">{result.status.replaceAll("_", " ")}</span><span>·</span><span className="truncate">{result.detail}</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
