import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ShieldCheck, Sparkles, CheckCircle2, Wrench, Shield, Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso privado a SDigitalCore Enterprise.",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(460px,46%)_1fr]">
      {/* Panel Izquierdo: Branding Enterprise High-Tech */}
      <section
        className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between"
        aria-label="SDigitalCore"
      >
        {/* Luces de fondo y texturas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px]"
        />

        {/* Cabecera de Marca */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner backdrop-blur-md">
              <Image src="/logo.png" alt="" width={38} height={38} className="h-7 w-7 object-contain" priority unoptimized />
            </span>
            <div>
              <span className="block text-base font-bold tracking-tight text-white">SDigitalCore</span>
              <span className="block text-[10px] font-semibold text-indigo-300">Enterprise Suite</span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistema Activo
          </span>
        </div>

        {/* Mensaje Central y Tarjetas Flotantes */}
        <div className="relative z-10 max-w-md py-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur-sm mb-6">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Gestión integral de dispositivos</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-4xl">
            Control de inventario, taller y garantías en un solo lugar.
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Plataforma centralizada para liquidaciones instantáneas de técnicos, control de calidad y trazabilidad de mercancía.
          </p>

          {/* Micro-tarjetas de beneficios */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Pagos y Aprobaciones Inmediatas</p>
                <p className="text-[11px] text-slate-400">Acreditación directa al wallet con 1 solo clic.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Shield size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Trazabilidad de Garantías</p>
                <p className="text-[11px] text-slate-400">Historial completo por IMEI desde recepción hasta entrega.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel oscuro */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Señal Digital</span>
          <span className="font-mono text-[11px]">v2.4.0-prod</span>
        </div>
      </section>

      {/* Panel Derecho: Formulario de Inicio de Sesión */}
      <section className="flex min-h-dvh items-center justify-center bg-slate-50/40 px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Logo en móvil */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <Image src="/logo.png" alt="" width={38} height={38} className="h-7 w-7 object-contain" priority unoptimized />
            </span>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-900">SDigitalCore</span>
              <span className="block text-[10px] font-semibold text-indigo-600">Enterprise Suite</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Bienvenido</h2>
              <p className="mt-1.5 text-xs text-slate-500">Ingresa tus credenciales para acceder a la plataforma.</p>
            </div>

            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100" />}>
              <LoginForm />
            </Suspense>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 border-t border-slate-100 pt-5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Conexión segura y auditada con Auth.js</span>
            </div>
            <div className="mt-4 text-center text-xs text-slate-500">
              ¿Necesitas la aplicación? <a href="/descargas" className="font-semibold text-indigo-600 hover:text-indigo-700">Descargar SDigitalCore</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
