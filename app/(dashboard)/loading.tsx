function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-7" aria-label="Cargando contenido de la página">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <LoadingBlock className="h-9 w-64" />
          <LoadingBlock className="h-4 w-80 max-w-full" />
        </div>
        <LoadingBlock className="h-10 w-32" />
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <LoadingBlock className="h-56" />
        <LoadingBlock className="h-56" />
      </section>
      <LoadingBlock className="h-48" />
    </div>
  );
}

