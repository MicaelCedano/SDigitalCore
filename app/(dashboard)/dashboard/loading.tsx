export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1360px] space-y-6 animate-pulse" aria-label="Cargando panel de control">
      {/* 1. Header Skeleton */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <div className="h-3.5 w-40 rounded-md bg-slate-200" />
          </div>
          <div className="h-8 w-64 rounded-xl bg-slate-200" />
          <div className="h-3.5 w-80 max-w-full rounded-md bg-slate-200" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="h-9 w-32 rounded-xl bg-slate-200" />
          <div className="h-9 w-32 rounded-xl bg-slate-200" />
          <div className="h-9 w-28 rounded-xl bg-slate-200" />
        </div>
      </section>

      {/* 2. KPIs Skeleton (5 columnas) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="h-6 w-24 rounded-md bg-slate-200" />
              <div className="h-3 w-28 rounded-md bg-slate-200" />
            </div>
          </div>
        ))}
      </section>

      {/* 3. Grid de Estaciones de Trabajo (2 columnas) */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4 min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-3 w-56 rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100/70" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4 min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-3 w-56 rounded bg-slate-200" />
              </div>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100/70" />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Grid de Garantías y Logística (2 columnas) */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4 min-h-[320px]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="h-10 w-10 rounded-xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3 w-64 rounded bg-slate-200" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100/70" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4 min-h-[320px]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="h-10 w-10 rounded-xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3 w-64 rounded bg-slate-200" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100/70" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
