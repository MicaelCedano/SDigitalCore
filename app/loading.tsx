export default function Loading() {
  return (
    <main className="flex min-h-[40vh] items-center justify-center px-5 py-12">
      <div className="rounded-2xl border border-[#e4e7ec] bg-white px-6 py-5 text-center shadow-sm">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#d0d5dd] border-t-[#4f46e5]" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-[#667085]">Cargando información...</p>
      </div>
    </main>
  );
}
