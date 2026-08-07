import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso privado a SDigitalCore.",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(420px,42%)_1fr]">
      <section className="relative hidden overflow-hidden bg-[#07152f] px-12 py-11 text-white lg:flex lg:flex-col lg:justify-between" aria-label="SDigitalCore">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-12 h-[520px] w-[520px] rotate-[-12deg] rounded-[88px] border border-[#4f67ff]/40" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-40 h-[520px] w-[520px] rotate-[33deg] rounded-[88px] border border-[#4f67ff]/25" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-24 h-[420px] w-[420px] rotate-[48deg] rounded-[80px] border border-[#4f67ff]/20" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] bg-white">
            <Image src="/logo.png" alt="" width={38} height={38} className="h-9 w-9 object-contain" priority unoptimized />
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">SDigitalCore</span>
        </div>

        <div className="relative z-10 max-w-lg pb-12">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-0.04em] xl:text-[44px]">Operaciones claras.<br />Decisiones rápidas.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#b9c4d8]">Una plataforma para conectar inventario, ventas, taller y control de calidad.</p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[430px] animate-fade-in">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] border border-[#e4e7ec]">
            <Image src="/logo.png" alt="" width={38} height={38} className="h-9 w-9 object-contain" priority unoptimized />
            </span>
            <span className="text-lg font-bold tracking-[-0.025em] text-[#101828]">SDigitalCore</span>
          </div>

          <div>
            <h2 className="text-[32px] font-bold tracking-[-0.04em] text-[#101828] sm:text-4xl">Bienvenido de nuevo</h2>
            <p className="mt-3 text-[15px] text-[#667085]">Ingresa tus credenciales para continuar.</p>
          </div>

          <div className="mt-9">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-[#f2f4f7]" />}>
              <LoginForm />
            </Suspense>
          </div>

          <div className="mt-10 flex items-center gap-2 text-xs text-[#667085]">
            <ShieldCheck size={16} strokeWidth={1.75} />
            <span>Acceso privado y auditado.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
