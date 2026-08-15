"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Error de ruta", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-[#e4e7ec] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b42318]">Error inesperado</p>
        <h1 className="mt-3 text-2xl font-bold text-[#101828]">No pudimos cargar esta pantalla</h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">Intenta nuevamente. Si el problema continúa, vuelve al centro de operaciones o repórtalo al administrador.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4338ca]">Intentar de nuevo</button>
          <Link href="/dashboard" className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#f8fafc]">Ir al dashboard</Link>
        </div>
      </section>
    </main>
  );
}
