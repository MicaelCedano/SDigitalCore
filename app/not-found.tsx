import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-[#e4e7ec] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5]">404</p>
        <h1 className="mt-3 text-2xl font-bold text-[#101828]">Página no encontrada</h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">La ruta o el registro solicitado no existe, o ya no está disponible.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4338ca]">Volver al dashboard</Link>
      </section>
    </main>
  );
}
