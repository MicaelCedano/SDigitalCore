"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset, resetPassword } from "@/app/actions/password-reset";

export function PasswordResetForm({ token }: { token?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null); setError(null); setSubmitting(true);
    const result = token
      ? await resetPassword({ token, password, confirmPassword })
      : await requestPasswordReset({ identifier });
    setSubmitting(false);
    if (!result.success) return setError(result.error);
    setMessage(token ? "Contraseña actualizada. Ya puedes iniciar sesión." : "Si los datos coinciden, recibirás un enlace en tu correo.");
    if (!token) setIdentifier("");
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
      <h1 className="text-xl font-bold text-slate-900">{token ? "Nueva contraseña" : "Recuperar contraseña"}</h1>
      <p className="mt-2 text-sm text-slate-600">{token ? "Escribe una contraseña nueva para tu cuenta." : "Escribe tu usuario o correo electrónico y te enviaremos un enlace."}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {!token && <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Usuario o correo" autoComplete="username" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" required />}
        {token && <><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" required minLength={8} /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" required /></>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        <button disabled={submitting} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? "Procesando..." : token ? "Actualizar contraseña" : "Enviar enlace"}</button>
      </form>
      <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-slate-700 hover:underline">Volver al inicio de sesión</Link>
    </section>
  </main>;
}
