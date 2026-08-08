"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { accessRequestSchema, type AccessRequestInput } from "@/lib/validation/access-request";
import { submitAccessRequestAction } from "@/app/actions/user-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { User, AtSign, Mail, Phone, CheckCircle2, ArrowLeft, Loader2, ShieldAlert, LockKeyhole } from "lucide-react";

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
    <main className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 p-4">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6 animate-fade-in my-8">
        {/* Back Link */}
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver a Iniciar Sesión</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-2 transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              unoptimized
              alt="SDigital Logo"
              width={80}
              height={80}
              className="object-contain drop-shadow-xs"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Solicitar Acceso</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              SDigitalCore — Registro sujeto a aprobación del Administrador
            </p>
          </div>
        </div>

        {/* Card Form */}
        <Card className="border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xl shadow-slate-200/70">
          {isSubmitted ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">¡Solicitud Enviada!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tu solicitud ha sido enviada. El Administrador te asignará el rol correspondiente y activará tu cuenta.
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 text-left flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Podrás iniciar sesión en cuanto el Administrador apruebe tu usuario en el módulo de <strong>Configuración</strong>.
                </span>
              </div>

              <div className="pt-2">
                <Link href="/login">
                  <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700">
                    Regresar al Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-base font-bold text-slate-900">Datos del Usuario</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Ingresa tus datos para solicitar el acceso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Nombre completo */}
                  <div className="space-y-1">
                    <label htmlFor="req-name" className="text-xs font-semibold text-slate-700">
                      Nombre completo
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="req-name"
                        name="name"
                        type="text"
                        placeholder="Ej. Juan Pérez"
                        className={`pl-9.5 ${errors.name ? "border-red-500" : ""}`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                  </div>

                  {/* Usuario */}
                  <div className="space-y-1">
                    <label htmlFor="req-username" className="text-xs font-semibold text-slate-700">
                      Usuario
                    </label>
                    <div className="relative flex items-center">
                      <AtSign className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="req-username"
                        name="username"
                        type="text"
                        placeholder="jperez"
                        className={`pl-9.5 ${errors.username ? "border-red-500" : ""}`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username}</p>}
                  </div>

                  {/* Correo electrónico */}
                  <div className="space-y-1">
                    <label htmlFor="req-email" className="text-xs font-semibold text-slate-700">
                      Correo electrónico
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="req-email"
                        name="email"
                        type="email"
                        placeholder="juan.perez@empresa.com"
                        className={`pl-9.5 ${errors.email ? "border-red-500" : ""}`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-1">
                    <label htmlFor="req-phone" className="text-xs font-semibold text-slate-700">
                      Teléfono
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="req-phone"
                        name="phone"
                        type="tel"
                        placeholder="809-555-0100"
                        className={`pl-9.5 ${errors.phone ? "border-red-500" : ""}`}
                        disabled={isPending}
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="req-password" className="text-xs font-semibold text-slate-700">Contraseña</label>
                      <div className="relative flex items-center">
                        <LockKeyhole className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <Input id="req-password" name="password" type="password" autoComplete="new-password" className={`pl-9.5 ${errors.password ? "border-red-500" : ""}`} disabled={isPending} />
                      </div>
                      {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="req-confirm-password" className="text-xs font-semibold text-slate-700">Confirmar</label>
                      <div className="relative flex items-center">
                        <LockKeyhole className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <Input id="req-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" className={`pl-9.5 ${errors.confirmPassword ? "border-red-500" : ""}`} disabled={isPending} />
                      </div>
                      {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
                    </div>
                  </div>

                  {submitError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{submitError}</p> : null}

                  <Button
                    type="submit"
                    variant="default"
                    className="w-full py-2.5 font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 shadow-md"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando solicitud...</span>
                      </>
                    ) : (
                      <span>Enviar Solicitud</span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
