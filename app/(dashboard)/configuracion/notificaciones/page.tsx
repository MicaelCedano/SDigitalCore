import { BellRing, Smartphone } from "lucide-react";
import { redirect } from "next/navigation";
import { getPersistedCurrentUser, requireUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { PushTestPanel } from "@/components/admin/PushTestPanel";

export default async function AdminNotificationsPage() {
  await requireUser();
  const actor = await getPersistedCurrentUser();
  if (actor?.roleCode !== "ADMIN" || actor.status !== "ACTIVE") redirect("/dashboard");

  const notificationUsers = await prisma.user.findMany({
    where: { username: { in: ["test", "admin"] } },
    select: { username: true, status: true, pushDevices: { select: { platform: true, appVersion: true, lastSeenAt: true } } },
  });
  const testUser = notificationUsers.find((user) => user.username === "test");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Administración</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900"><BellRing className="text-indigo-600" size={25} />Prueba de notificaciones</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Envía una notificación push de prueba al usuario <strong className="text-slate-700">test</strong>. Solo se usan dispositivos registrados en la APK.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Smartphone size={20} /></div>
          <div><p className="text-sm font-bold text-slate-900">Dispositivo del usuario test</p><p className="text-xs text-slate-500">{testUser ? `${testUser.status === "ACTIVE" ? "Activo" : "Inactivo"} · ${testUser.pushDevices.length} dispositivo(s)` : "Usuario no encontrado"}</p></div>
        </div>
        {testUser?.pushDevices.length ? <div className="mt-4 space-y-2">{testUser.pushDevices.map((device, index) => <div key={`${device.platform}-${index}`} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>{device.platform} · APK {device.appVersion ?? "sin versión"}</span><span>Último uso: {device.lastSeenAt.toLocaleString("es-DO")}</span></div>)}</div> : null}
      </section>

      <PushTestPanel targets={notificationUsers.filter((user) => user.username).map((user) => ({ username: user.username!, status: user.status, deviceCount: user.pushDevices.length }))} />
    </main>
  );
}
