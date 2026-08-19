import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { isValidPenaltyVerificationToken } from "@/lib/qc/penalty-verification";

export const metadata: Metadata = {
  title: "Verificación de penalidad",
  robots: { index: false, follow: false },
};

function money(value: unknown) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value));
}

function personName(person: { name: string | null; username: string | null }) {
  return person.name || person.username || "Sin nombre";
}

export default async function PenaltyVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const params = await searchParams;
  const id = params.id?.trim() || "";
  const token = params.token?.trim() || "";
  const validSignature = id.length > 0 && token.length > 0 && isValidPenaltyVerificationToken(id, token);
  const penalty = validSignature
    ? await prisma.penalty.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          status: true,
          monto: true,
          motivo: true,
          deviceImei: true,
          deviceModel: true,
          createdAt: true,
          technician: { select: { name: true, username: true } },
          admin: { select: { name: true, username: true } },
        },
      })
    : null;
  const verified = Boolean(validSignature && penalty);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className={`p-7 text-center text-white ${verified ? "bg-indigo-600" : "bg-rose-600"}`}>
            {verified ? <CheckCircle2 className="mx-auto h-12 w-12" /> : <XCircle className="mx-auto h-12 w-12" />}
            <h1 className="mt-3 text-2xl font-black">{verified ? "Penalidad verificada" : "Verificación no válida"}</h1>
            <p className="mt-1 text-sm text-white/80">SDigitalCore · Control de Calidad</p>
          </div>
          {verified && penalty ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estado</span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${penalty.status === "ACTIVE" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                  {penalty.status === "ACTIVE" ? "ACTIVA" : "REVERTIDA"}
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Responsable</span><span className="text-right font-black">{personName(penalty.technician)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Monto</span><span className="font-mono font-black text-rose-600">{money(penalty.monto)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Tipo</span><span className="font-black">{penalty.type === "INTERNAL" ? "Por IMEI" : "Externa"}</span></div>
                {penalty.deviceImei ? <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">IMEI</span><span className="font-mono text-right font-bold">{penalty.deviceImei}</span></div> : null}
                {penalty.deviceModel ? <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Modelo</span><span className="text-right font-bold">{penalty.deviceModel}</span></div> : null}
                <div className="border-t border-slate-200 pt-3"><span className="font-bold text-slate-500">Motivo</span><p className="mt-1 font-semibold">{penalty.motivo}</p></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Aplicada por</span><span className="text-right font-bold">{personName(penalty.admin)}</span></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Fecha</span><span className="text-right font-bold">{new Date(penalty.createdAt).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium", timeStyle: "short" })}</span></div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold text-indigo-800"><ShieldCheck className="h-4 w-4 shrink-0" /> Este comprobante fue validado contra el registro oficial.</div>
            </div>
          ) : (
            <div className="p-7 text-center text-sm font-semibold text-slate-600">El enlace no es auténtico, está incompleto o la penalidad no existe.</div>
          )}
        </section>
      </div>
    </main>
  );
}
