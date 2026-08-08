"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {globalError ? (
        <div className="animate-fade-in flex items-center gap-2.5 rounded-[10px] border border-[#fecdca] bg-[#fef3f2] p-3.5 text-sm text-[#b42318]" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#d92d20]" />
          <span>{globalError}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="login-username" className="text-sm font-medium text-[#344054]">Usuario o correo electrónico</label>
        <div className="relative flex items-center">
          <User className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-[#667085]" strokeWidth={1.75} />
          <Input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            placeholder="usuario@empresa.com"
            className={`h-12 pl-11 ${errors.username ? "border-[#d92d20] focus:border-[#d92d20] focus:ring-[#d92d20]/10" : ""}`}
            disabled={isPending}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? "username-error" : undefined}
          />
        </div>
        {errors.username ? <p id="username-error" className="text-xs text-[#d92d20]">{errors.username}</p> : null}
      </div>

      <div className="space-y-2">
        <div>
          <label htmlFor="login-password" className="text-sm font-medium text-[#344054]">Contraseña</label>
        </div>
        <div className="relative flex items-center">
          <Lock className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-[#667085]" strokeWidth={1.75} />
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`h-12 pl-11 pr-11 ${errors.password ? "border-[#d92d20] focus:border-[#d92d20] focus:ring-[#d92d20]/10" : ""}`}
            disabled={isPending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            className="focus-ring absolute right-2.5 rounded-md p-1.5 text-[#667085] hover:bg-[#f2f4f7] hover:text-[#344054]"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password ? <p id="password-error" className="text-xs text-[#d92d20]">{errors.password}</p> : null}
      </div>

      <Button type="submit" className="h-12 w-full text-sm" disabled={isPending}>
        {isPending ? <><Loader2 className="animate-spin" /><span>Ingresando...</span></> : <span>Iniciar sesión</span>}
      </Button>

      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-[#e4e7ec]" />
        <p className="whitespace-nowrap text-center text-sm text-[#667085]">
          ¿Nuevo usuario? <a href="/solicitar-acceso" className="focus-ring rounded font-semibold text-[#4f46e5] hover:text-[#4338ca] hover:underline">Solicita acceso</a>
        </p>
        <span className="h-px flex-1 bg-[#e4e7ec]" />
      </div>
    </form>
  );
}
