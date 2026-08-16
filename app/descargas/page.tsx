import type { Metadata } from "next";
import Image from "next/image";
import { Download, Monitor, Smartphone } from "lucide-react";

export const metadata: Metadata = { title: "Descargas", description: "Descarga las aplicaciones oficiales de SDigitalCore." };

const releaseBase = "https://github.com/MicaelCedano/SDigitalCore/releases/download/v0.1.1";

export default function DownloadsPage() {
  return <main className="min-h-dvh bg-slate-950 px-5 py-10 text-white sm:px-8"><div className="mx-auto max-w-4xl">
    <div className="flex items-center gap-3"><Image src="/logo.png" alt="SDigitalCore" width={44} height={44} className="h-11 w-11 object-contain" unoptimized /><div><p className="text-lg font-bold">SDigitalCore</p><p className="text-xs text-indigo-300">Enterprise Suite</p></div></div>
    <div className="mt-14 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Versión 0.1.1</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Descarga SDigitalCore</h1><p className="mt-4 text-sm leading-7 text-slate-300">Instala la versión oficial para trabajar desde Windows o recibir notificaciones en Android.</p></div>
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300"><Monitor size={22} /></div><h2 className="mt-5 text-xl font-bold">Aplicación de escritorio</h2><p className="mt-2 text-sm leading-6 text-slate-400">Para Windows 10 y 11. Incluye instalador recomendado y paquete MSI.</p><div className="mt-6 grid gap-2"><a className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold hover:bg-indigo-400" href={`${releaseBase}/SDigitalCore_0.1.1_x64-setup.exe`}><Download size={17} />Descargar para Windows</a><a className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10" href={`${releaseBase}/SDigitalCore_0.1.1_x64_en-US.msi`}>Descargar MSI</a></div></section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300"><Smartphone size={22} /></div><h2 className="mt-5 text-xl font-bold">Aplicación móvil</h2><p className="mt-2 text-sm leading-6 text-slate-400">APK oficial para Android con registro de dispositivo y notificaciones push.</p><a className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-400" href={`${releaseBase}/SDigitalCore_0.1.1_android-signed.apk`}><Download size={17} />Descargar APK Android</a></section>
    </div>
    <p className="mt-8 text-center text-xs text-slate-500">Descargas publicadas en GitHub Releases · <a href="/login" className="text-indigo-300 hover:text-indigo-200">Iniciar sesión</a></p>
  </div></main>;
}
