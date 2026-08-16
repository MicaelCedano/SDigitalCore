"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User, ArrowRight } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<LoginInput>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setGlobalError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      username: formData.get("username") as string,
      password: formData.get("password") as string,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<LoginInput> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof LoginInput] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        username: parsed.data.username,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        setGlobalError("Credenciales incorrectas. Verifica tu usuario y contraseña.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {globalError ? (
        <div
          className="animate-fade-in flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-800"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{globalError}</span>
        </div>
      ) : null}

      {/* Usuario o Correo */}
      <div className="space-y-1.5">
        <label htmlFor="login-username" className="block text-xs font-bold text-slate-700">
          Usuario o correo electrónico
        </label>
        <div className="relative flex items-center">
          <User className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            placeholder="usuario@empresa.com"
            className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
              errors.username ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
            }`}
            disabled={isPending}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? "username-error" : undefined}
          />
        </div>
        {errors.username ? <p id="username-error" className="text-[11px] font-medium text-rose-600">{errors.username}</p> : null}
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="block text-xs font-bold text-slate-700">
            Contraseña
          </label>
          <Link
            href="/recuperar-password"
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative flex items-center">
          <Lock className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.8} />
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`h-11 w-full rounded-xl border bg-slate-50/50 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
              errors.password ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
            }`}
            disabled={isPending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            className="focus-ring absolute right-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password ? <p id="password-error" className="text-[11px] font-medium text-rose-600">{errors.password}</p> : null}
      </div>

      {/* Botón de Ingreso */}
      <button
        type="submit"
        disabled={isPending}
        className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verificando credenciales...</span>
          </>
        ) : (
          <>
            <span>Iniciar sesión</span>
            <ArrowRight size={14} />
          </>
        )}
      </button>

      {/* Solicitar Acceso */}
      <div className="pt-2 text-center">
        <p className="text-xs text-slate-500">
          ¿No tienes una cuenta?{" "}
          <Link
            href="/solicitar-acceso"
            className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Solicitar acceso
          </Link>
        </p>
      </div>
    </form>
  );
}
