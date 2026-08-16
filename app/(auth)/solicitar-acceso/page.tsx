"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { accessRequestSchema, type AccessRequestInput } from "@/lib/validation/access-request";
import { submitAccessRequestAction } from "@/app/actions/user-management";
import {
  User,
  AtSign,
  Mail,
  Phone,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export default function SolicitarAccesoPage() {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<AccessRequestInput>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const formData = new FormData(e.currentTarget);
    const raw = {
      name: formData.get("name") as string,
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = accessRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Partial<AccessRequestInput> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AccessRequestInput;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await submitAccessRequestAction(parsed.data);
      if (result.success) setIsSubmitted(true);
      else setSubmitError(result.error);
    });
  }

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(460px,46%)_1fr]">
      {/* Panel Izquierdo: Branding & Pasos */}
      <section
        className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between"
        aria-label="SDigitalCore Registro"
      >
        {/* Luces y auras difusas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px]"
        />

        {/* Header de Marca */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner backdrop-blur-md">
              <Image src="/logo.png" alt="" width={38} height={38} className="h-7 w-7 object-contain" priority unoptimized />
            </span>
            <div>
              <span className="block text-base font-bold tracking-tight text-white">SDigitalCore</span>
              <span className="block text-[10px] font-semibold text-indigo-300">Enterprise Suite</span>
            </div>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Registro Institucional
          </span>
        </div>

        {/* Contenido Central: Proceso de Alta */}
        <div className="relative z-10 max-w-md py-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur-sm mb-6">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Proceso de incorporación</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-4xl">
            Únete al equipo operativo de Señal Digital.
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Completa el formulario con tus datos de contacto y credenciales. Un administrador validará tu perfil y te asignará los permisos de taller, control de calidad o almacén.
          </p>

          {/* Pasos visuales */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                1
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Envía tu Solicitud</p>
                <p className="text-[11px] text-slate-400">Ingresa tu usuario, correo y número telefónico.</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                2
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Validación por Administración</p>
                <p className="text-[11px] text-slate-400">El administrador activa tu cuenta y rol correspondiente.</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                3
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Acceso Inmediato</p>
                <p className="text-[11px] text-slate-400">Inicia sesión y accede a tus módulos y billetera digital.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel oscuro */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Señal Digital</span>
          <Link href="/login" className="text-indigo-300 hover:text-white transition-colors">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </section>

      {/* Panel Derecho: Formulario de Registro */}
      <section className="flex min-h-dvh items-center justify-center bg-slate-50/40 px-6 py-10 sm:px-12">
        <div className="w-full max-w-[460px] animate-fade-in my-6">
          {/* Botón Volver */}
          <div className="mb-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Volver a Iniciar Sesión</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            {isSubmitted ? (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">¡Solicitud Enviada con Éxito!</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Tu solicitud ha sido registrada en el sistema. El Administrador te asignará tu rol y activará tu cuenta a la brevedad.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-left flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Podrás iniciar sesión tan pronto la administración valide tu perfil en el panel de control.
                  </span>
                </div>

                <div className="pt-3">
                  <Link
                    href="/login"
                    className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.99] transition-all"
                  >
                    <span>Ir a Iniciar Sesión</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Solicitar Acceso</h2>
                  <p className="mt-1.5 text-xs text-slate-500">Completa tus datos para crear tu cuenta en la plataforma.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Nombre completo */}
                  <div className="space-y-1.5">
                    <label htmlFor="req-name" className="block text-xs font-bold text-slate-700">
                      Nombre completo
                    </label>
                    <div className="relative flex items-center">
                      <User className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                      <input
                        id="req-name"
                        name="name"
                        type="text"
                        placeholder="Ej. Juan Pérez"
                        className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                          errors.name ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                        }`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.name && <p className="text-[11px] font-medium text-rose-600">{errors.name}</p>}
                  </div>

                  {/* Usuario */}
                  <div className="space-y-1.5">
                    <label htmlFor="req-username" className="block text-xs font-bold text-slate-700">
                      Nombre de usuario
                    </label>
                    <div className="relative flex items-center">
                      <AtSign className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                      <input
                        id="req-username"
                        name="username"
                        type="text"
                        placeholder="jperez"
                        className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                          errors.username ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                        }`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.username && <p className="text-[11px] font-medium text-rose-600">{errors.username}</p>}
                  </div>

                  {/* Correo y Teléfono en 2 columnas */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="req-email" className="block text-xs font-bold text-slate-700">
                        Correo electrónico
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                        <input
                          id="req-email"
                          name="email"
                          type="email"
                          placeholder="juan@empresa.com"
                          className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                            errors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                          disabled={isPending}
                        />
                      </div>
                      {errors.email && <p className="text-[11px] font-medium text-rose-600">{errors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="req-phone" className="block text-xs font-bold text-slate-700">
                        Teléfono / WhatsApp
                      </label>
                      <div className="relative flex items-center">
                        <Phone className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                        <input
                          id="req-phone"
                          name="phone"
                          type="tel"
                          placeholder="809-555-0100"
                          className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                            errors.phone ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                          disabled={isPending}
                        />
                      </div>
                      {errors.phone && <p className="text-[11px] font-medium text-rose-600">{errors.phone}</p>}
                    </div>
                  </div>

                  {/* Contraseñas en 2 columnas */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="req-password" className="block text-xs font-bold text-slate-700">
                        Contraseña
                      </label>
                      <div className="relative flex items-center">
                        <LockKeyhole className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                        <input
                          id="req-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                            errors.password ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                          disabled={isPending}
                        />
                      </div>
                      {errors.password && <p className="text-[11px] font-medium text-rose-600">{errors.password}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="req-confirm-password" className="block text-xs font-bold text-slate-700">
                        Confirmar contraseña
                      </label>
                      <div className="relative flex items-center">
                        <LockKeyhole className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
                        <input
                          id="req-confirm-password"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                            errors.confirmPassword ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                          disabled={isPending}
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-[11px] font-medium text-rose-600">{errors.confirmPassword}</p>}
                    </div>
                  </div>

                  {submitError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-800">
                      {submitError}
                    </div>
                  ) : null}

                  {/* Botón de Envío */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Enviando solicitud...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Solicitud de Acceso</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 border-t border-slate-100 pt-5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Tu información será revisada y auditada de forma segura.</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
