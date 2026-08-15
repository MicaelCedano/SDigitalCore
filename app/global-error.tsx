"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50">
        <main className="flex min-h-screen items-center justify-center px-5 py-12">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">SDigitalCore</p>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">El sistema necesita reiniciarse</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ocurrió un error al cargar la aplicación. Puedes intentar cargarla nuevamente.</p>
            <button type="button" onClick={() => reset()} className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Intentar de nuevo</button>
          </section>
        </main>
      </body>
    </html>
  );
}
