"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

const notificationTemplates = [
  { id: "test-connected", group: "Pruebas del usuario test", label: "Conexión de dispositivo", title: "Dispositivo conectado", body: "El usuario test registró correctamente su dispositivo Android en SDigitalCore." },
  { id: "test-foreground", group: "Pruebas del usuario test", label: "Prueba con la app abierta", title: "Notificación en primer plano", body: "Esta notificación confirma que el flujo funciona con SDigitalCore abierto." },
  { id: "test-background", group: "Pruebas del usuario test", label: "Prueba con la app cerrada", title: "Notificación en segundo plano", body: "Cierra la aplicación y confirma que este aviso aparece en la bandeja del teléfono." },
  { id: "test-action", group: "Pruebas del usuario test", label: "Abrir dashboard", title: "Tienes una actualización", body: "Toca esta notificación para comprobar el flujo de apertura hacia el dashboard." },
  { id: "admin-warehouse", group: "Simulación de avisos administrativos", label: "Solicitud de almacén", title: "Solicitud de almacén pendiente", body: "Hay una solicitud de almacén esperando revisión del administrador." },
  { id: "admin-qc", group: "Simulación de avisos administrativos", label: "Lote de control de calidad", title: "Lote QC listo para revisión", body: "Un lote de control de calidad fue enviado y requiere una decisión administrativa." },
  { id: "admin-warranty", group: "Simulación de avisos administrativos", label: "Garantía pendiente", title: "Caso de garantía pendiente", body: "Un caso de garantía necesita seguimiento del equipo administrativo." },
  { id: "admin-urgent", group: "Simulación de avisos administrativos", label: "Aviso urgente", title: "Aviso urgente de SDigitalCore", body: "Este mensaje simula una alerta prioritaria enviada por administración." },
] as const;

export function PushTestPanel({ available }: { available: boolean }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(notificationTemplates[0].id);
  const [title, setTitle] = useState<string>(notificationTemplates[0].title);
  const [body, setBody] = useState<string>(notificationTemplates[0].body);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function selectTemplate(templateId: string) {
    const template = notificationTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setTitle(template.title);
    setBody(template.body);
    setStatus(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/push-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "test", title, body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar.");
      setStatus(`Enviada: ${result.sent} dispositivo(s). Fallidas: ${result.failed}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo enviar la notificación.");
    } finally {
      setSending(false);
    }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-base font-bold text-slate-900">Enviar push de prueba</h2>
    <p className="mt-1 text-sm text-slate-500">Selecciona un escenario, revisa el texto y envíalo al dispositivo registrado del usuario test.</p>
    <div className="mt-4 grid gap-4">
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Plantilla del flujo<select value={selectedTemplateId} onChange={(event) => selectTemplate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-indigo-500">
        <optgroup label="Pruebas del usuario test">{notificationTemplates.filter((template) => template.group === "Pruebas del usuario test").map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</optgroup>
        <optgroup label="Simulación de avisos administrativos">{notificationTemplates.filter((template) => template.group === "Simulación de avisos administrativos").map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</optgroup>
      </select></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Mensaje<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={240} required rows={3} className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500" /></label>
    </div>
    <button type="submit" disabled={!available || sending} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {sending ? "Enviando…" : "Enviar al usuario test"}</button>
    {status ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" role="status">{status}</p> : null}
    {!available ? <p className="mt-3 text-xs text-amber-700">Instala la APK e inicia sesión como test para registrar primero el dispositivo.</p> : null}
  </form>;
}
