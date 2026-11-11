"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Building2, CalendarDays, CheckCircle2, ClipboardList, Cpu, Eye, FilePenLine, Palette, Plus, Printer, RefreshCw, Search, Send, Share2, UserRound, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWarehouseRequestsAction, updateWarehouseRequestStatusAction } from "../actions/warehouse";
import { emptyWarehouseRequest, useWarehouseRequestDraft } from "../hooks/useWarehouseRequestDraft";
import { WarehouseRequestForm } from "./WarehouseRequestForm";

type WarehouseRequest = NonNullable<Awaited<ReturnType<typeof getWarehouseRequestsAction>>["data"]>[number];
type RequestItem = WarehouseRequest["items"][number];
type RequestProduct = RequestItem["product"];

const draftDateFormat = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo",
});

export function WarehouseRequestsManager({ roleCode, draftOwnerId }: { roleCode: string; draftOwnerId?: string }) {
  const isAdmin = roleCode === "ADMIN";
  const [requests, setRequests] = useState<WarehouseRequest[]>([]);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [voucherRequest, setVoucherRequest] = useState<WarehouseRequest | null>(null);
  const [sharingVoucher, setSharingVoucher] = useState(false);
  const [detailRequest, setDetailRequest] = useState<WarehouseRequest | null>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const { draft, ready, storageError, saveDraft, discardDraft, clearDraftAfterSend } = useWarehouseRequestDraft(draftOwnerId);

  useEffect(() => {
    let active = true;
    const failed = () => { if (active) setHistoryError("No se pudo cargar el historial de solicitudes."); };
    void getWarehouseRequestsAction(search, "ALL").then((result) => {
      if (!active) return;
      if (!result.success) return failed();
      setRequests(result.data ?? []);
      setHistoryError("");
    }).catch(failed);
    return () => { active = false; };
  }, [search, refresh]);

  const openForm = () => {
    setConfirmDiscard(false);
    setSentCode("");
    setError("");
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    requestAnimationFrame(() => actionButton.current?.focus());
  };

  const update = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (updatingId) return;
    setError("");
    setUpdatingId(id);
    try {
      const result = await updateWarehouseRequestStatusAction(id, status);
      if (!result.success) setError(result.error ?? "No se pudo procesar la solicitud.");
      setRefresh((current) => current + 1);
    } catch {
      setError("No se pudo procesar la solicitud.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Detalle estructurado de una solicitud: el campo details guarda un JSON con reason + items por producto
  const parseRequestDetails = (request: WarehouseRequest) => {
    let reason = request.details || request.title || "";
    let itemsMap: Record<string, { measure?: string; quantity?: number; unitsCount?: number }> = {};
    try {
      const parsed = JSON.parse(request.details || "{}");
      if (parsed && typeof parsed === "object") {
        reason = parsed.reason || request.title || "";
        itemsMap = parsed.items || {};
      }
    } catch { /* details no es JSON: queda el texto crudo */ }
    return { reason, itemsMap };
  };

  const formatRequestDate = (value?: string | Date | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" });
  };

  const formatItemPresentation = (item: RequestItem, detail?: { measure?: string; quantity?: number; unitsCount?: number }) => {
    const measure = detail?.measure ?? (item.unitsCount % (item.product?.unitsPerBox || 1) === 0 && item.unitsCount > 0 ? "BOXES" : "UNITS");
    if (measure === "BOXES") {
      const perBox = item.product?.unitsPerBox || 1;
      const boxes = detail?.quantity ?? Math.round((item.unitsCount || 0) / perBox);
      return `${boxes} ${boxes === 1 ? "caja" : "cajas"} (${item.unitsCount || boxes * perBox} uds)`;
    }
    return `${item.unitsCount} uds sueltas`;
  };

  const formatProductVariant = (product: RequestProduct | null | undefined) => {
    const attributes = [
      product?.capacity,
      product?.color,
    ].filter(Boolean);
    return attributes.join(" · ");
  };

  const formatProductLabel = (product: RequestProduct | null | undefined, fallback = "Producto") => {
    return [product?.brand, product?.name ?? fallback, formatProductVariant(product)]
      .filter(Boolean)
      .join(" ");
  };

  const voucherText = (request: WarehouseRequest) => {
    const lines = (request.items ?? []).map((item: RequestItem) => {
      return `${formatProductLabel(item.product, item.productId)}: ${item.unitsCount} uds`;
    }).join("\n");
    return `BOUCHER DE SOLICITUD ${request.requestCode}\n${request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}\nSucursal: ${request.branch}\nSolicitante: ${request.requestedBy}\nProductos:\n${lines}\nEstado: ${request.status === "PENDING" ? "Pendiente de aprobación" : request.status === "APPROVED" ? "Aprobada" : "Rechazada"}`;
  };

  const createVoucherImage = async (request: WarehouseRequest) => {
    const width = 900;
    const items = request.items ?? [];
    const lines = items.flatMap((item: RequestItem) => {
      const label = `${item.product?.code ?? item.productId} · ${formatProductLabel(item.product)}`;
      const words = label.split(" ");
      const wrapped: string[] = [];
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 48 && current) {
          wrapped.push(current);
          current = word;
        } else current = next;
      }
      if (current) wrapped.push(current);
      return wrapped.map((line, index) => ({ line, quantity: index === wrapped.length - 1 ? `${item.unitsCount} uds` : "" }));
    });
    const height = Math.max(560, 330 + lines.length * 34);
    const escapeXml = (value: unknown) => String(value ?? "").replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" }[character] ?? character));
    const status = request.status === "PENDING" ? "Esperando aprobación" : request.status === "APPROVED" ? "Aprobada" : "Rechazada";
    const itemSvg = lines.map(({ line, quantity }: { line: string; quantity: string }, index: number) => `<text x="70" y="${330 + index * 34}" font-size="24" fill="#1e293b">${escapeXml(line)}</text><text x="830" y="${330 + index * 34}" text-anchor="end" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(quantity)}</text>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><rect x="24" y="24" width="852" height="${height - 48}" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/><text x="70" y="88" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${request.type === "ENTRY" ? "#059669" : "#e11d48"}">BOUCHER DE SOLICITUD</text><text x="70" y="136" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#0f172a">${escapeXml(request.requestCode)}</text><text x="70" y="178" font-family="Arial, sans-serif" font-size="22" fill="#64748b">${escapeXml(request.branch)} · ${escapeXml(request.requestedBy)}</text><line x1="70" y1="215" x2="830" y2="215" stroke="#e2e8f0" stroke-width="2"/><text x="70" y="270" font-family="Arial, sans-serif" font-size="25" font-weight="800" fill="#0f172a">${request.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</text><text x="830" y="270" text-anchor="end" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#475569">${escapeXml(status)}</text>${itemSvg}<line x1="70" y1="${height - 100}" x2="830" y2="${height - 100}" stroke="#e2e8f0" stroke-width="2"/><text x="70" y="${height - 58}" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">SDigitalCore · Salida de almacén</text></svg>`;
    const blob = await new Promise<Blob>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo crear la imagen.")), "image/png");
      };
      image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    return blob;
  };

  const shareVoucherImage = async (request: WarehouseRequest) => {
    setSharingVoucher(true);
    try {
      const blob = await createVoucherImage(request);
      const file = new File([blob], `${request.requestCode}-boucher.png`, { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: `Boucher ${request.requestCode}`, text: voucherText(request) });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        setError("La imagen fue descargada. Adjunta el archivo en el chat de WhatsApp.");
      }
    } catch (shareError) {
      if ((shareError as DOMException)?.name !== "AbortError") setError("No se pudo compartir el boucher como imagen.");
    } finally {
      setSharingVoucher(false);
    }
  };

  if (showCreate && draftOwnerId) {
    return (
      <WarehouseRequestForm
        form={draft?.form ?? emptyWarehouseRequest}
        saved={!!draft}
        storageError={storageError}
        onChange={saveDraft}
        onClose={closeForm}
        onSent={(code) => {
          clearDraftAfterSend();
          setSentCode(code);
          setSearch("");
          setRefresh((current) => current + 1);
          closeForm();
        }}
      />
    );
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Solicitudes de almacén</h1>
        <p className="mt-1 text-sm text-slate-600">{isAdmin ? "Revisa, aprueba y procesa las solicitudes de movimiento." : "Consulta el estado de tus solicitudes de movimiento."}</p>
      </div>
      {draftOwnerId && !draft && <Button ref={actionButton} type="button" disabled={!ready} onClick={openForm}><Plus />Nueva solicitud</Button>}
    </header>
    {draft && <section aria-labelledby="warehouse-draft-title" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <FilePenLine aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-indigo-700" />
        <div className="min-w-0">
          <h2 id="warehouse-draft-title" className="text-sm font-bold text-slate-900">Solicitud en borrador</h2>
          <p className="mt-0.5 wrap-break-word text-sm text-indigo-950">
            {[draft.form.type === "ENTRY" ? "Entrada" : "Salida", draft.form.branch, `${draft.form.items.length} ${draft.form.items.length === 1 ? "producto" : "productos"}`].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-indigo-800">
            {storageError ? "Cambios sin guardar en el navegador" : `Guardado el ${draftDateFormat.format(new Date(draft.savedAt))}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={confirmDiscard ? "destructive" : "ghost"} onClick={() => {
          if (confirmDiscard) discardDraft();
          setConfirmDiscard(!confirmDiscard);
          requestAnimationFrame(() => actionButton.current?.focus());
        }}>{confirmDiscard ? "Sí, descartar" : "Descartar"}</Button>
        <Button ref={actionButton} type="button" variant={confirmDiscard ? "outline" : "default"} onClick={confirmDiscard ? () => setConfirmDiscard(false) : openForm}>
          {confirmDiscard ? "Conservar borrador" : "Continuar borrador"}
        </Button>
      </div>
    </section>}
    {storageError && !draft && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">El navegador no pudo eliminar el borrador guardado.</p>}
    {sentCode && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Solicitud {sentCode} enviada para aprobación.</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    <div className="relative w-full max-w-md">
      <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-slate-500" />
      <Input aria-label="Buscar solicitudes" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar solicitudes…" className="pl-9 placeholder:text-slate-500" />
    </div>
    {historyError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-800">
      {historyError}
      <Button type="button" size="sm" variant="outline" onClick={() => setRefresh((current) => current + 1)}>Reintentar</Button>
    </div>}
    <div className="space-y-3 md:hidden">
      {requests.map((r) => {
        const isUpdating = updatingId === r.id;
        const statusLabel = r.status === "PENDING" ? (isAdmin ? "PENDIENTE" : "Esperando aprobación") : r.status === "APPROVED" ? "APROBADA" : "RECHAZADA";
        const statusClass = r.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : r.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700";
        const detail = parseRequestDetails(r);
        return <article key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
            <div className="min-w-0">
              <button type="button" onClick={() => setDetailRequest(r)} className="font-mono text-sm font-bold text-[#5750f1] hover:underline" title="Ver detalle de la solicitud">{r.requestCode}</button>
              <p className="mt-1 text-xs text-slate-500">{r.requestedBy} · {r.branch}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.type === "ENTRY" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{r.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>{statusLabel}</span>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {(r.items ?? []).map((item: RequestItem) => <div key={item.id} className="rounded-xl border border-slate-100 bg-white">
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-slate-900">{item.product?.brand ? `${item.product.brand} · ` : ""}{item.product?.name ?? item.productId}</p>
                  <p className="mt-0.5 font-mono text-[11px] font-bold text-[#5750f1]">Código {item.product?.code ?? "—"}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{item.unitsCount} uds</span>
              </div>
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5 text-[11px] font-semibold text-slate-700">
                <span className="rounded-md bg-slate-100 px-2 py-1">Capacidad: {item.product?.capacity || "—"}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">Color: {item.product?.color || "—"}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">{formatItemPresentation(item, detail.itemsMap[item.productId])}</span>
              </div>
            </div>)}
            {(r.items ?? []).length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Esta solicitud no tiene productos registrados.</p>}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
            <button type="button" onClick={() => setDetailRequest(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><Eye className="h-4 w-4" />Ver</button>
            <button type="button" onClick={() => setVoucherRequest(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><Printer className="h-4 w-4" />Boucher</button>
            {isAdmin && r.status === "PENDING" && <>
              <button type="button" disabled={!!updatingId} onClick={() => void update(r.id, "APPROVED")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 disabled:cursor-wait disabled:opacity-60">{isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isUpdating ? "Procesando..." : "Aprobar"}</button>
              <button type="button" disabled={!!updatingId} onClick={() => void update(r.id, "REJECTED")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 disabled:cursor-wait disabled:opacity-60"><XCircle className="h-4 w-4" />Rechazar</button>
            </>}
            {!isAdmin && r.status === "PENDING" && <span className="self-center text-xs font-semibold text-slate-400">Esperando aprobación</span>}
          </div>
        </article>;
      })}
      {requests.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500"><Send className="mx-auto mb-2 h-8 w-8 text-slate-300" />No hay solicitudes.</div>}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 font-bold text-slate-600"><tr><th className="p-4">Código</th><th className="p-4">Tipo</th><th className="p-4">Productos</th><th className="p-4">Solicitante</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map((r) => { const isUpdating = updatingId === r.id; const statusLabel = r.status === "PENDING" ? (isAdmin ? "PENDIENTE" : "Esperando aprobación") : r.status === "APPROVED" ? "APROBADA" : "RECHAZADA"; const statusClass = r.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : r.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"; return <tr key={r.id} className="hover:bg-slate-50/70"><td className="p-4"><button type="button" onClick={() => setDetailRequest(r)} className="font-mono text-xs font-bold text-[#5750f1] hover:underline" title="Ver detalle de la solicitud">{r.requestCode}</button></td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${r.type === "ENTRY" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{r.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span></td><td className="p-4"><div className="space-y-1">{(r.items ?? []).slice(0, 2).map((item: RequestItem) => <p key={item.id} className="text-xs text-slate-600"><span className="font-semibold text-slate-800">{formatProductLabel(item.product, item.productId)}</span> · {item.unitsCount} uds</p>)}{(r.items ?? []).length > 2 && <p className="text-xs font-semibold text-[#5750f1]">+{r.items.length - 2} más</p>}{(r.items ?? []).length === 0 && <span className="text-xs text-slate-500">Sin productos</span>}</div></td><td className="p-4">{r.requestedBy}<span className="mt-1 block text-xs text-slate-500">{r.branch}</span></td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass}`}>{statusLabel}</span></td><td className="p-4 text-right"><span className="inline-flex flex-wrap justify-end gap-1">{<button type="button" onClick={() => setDetailRequest(r)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-200"><Eye className="h-3.5 w-3.5" />Ver</button>}{<button onClick={() => setVoucherRequest(r)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100"><Printer className="h-3.5 w-3.5" />Boucher</button>}{isAdmin && r.status === "PENDING" && <><button disabled={!!updatingId} onClick={() => void update(r.id, "APPROVED")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700 disabled:cursor-wait disabled:opacity-60">{isUpdating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isUpdating ? "Procesando..." : "Aprobar"}</button><button disabled={!!updatingId} onClick={() => void update(r.id, "REJECTED")} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 font-bold text-red-700 disabled:cursor-wait disabled:opacity-60"><XCircle className="h-3.5 w-3.5" />Rechazar</button></>}{!isAdmin && r.status === "PENDING" && <span className="self-center text-xs font-semibold text-slate-400">Esperando aprobación</span>}</span></td></tr>; })}</tbody></table>{requests.length === 0 && <div className="p-12 text-center text-sm text-slate-500"><Send className="mx-auto mb-2 h-8 w-8 text-slate-300" />No hay solicitudes.</div>}</div>

    {detailRequest && (() => { const detail = parseRequestDetails(detailRequest); const items = detailRequest.items ?? []; return <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"><div className="bg-white border border-slate-200 text-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" role="dialog" aria-modal="true" aria-label={`Detalle de ${detailRequest.requestCode}`}>
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20"><ClipboardList className="w-6 h-6" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Detalle de {detailRequest.requestCode}</h2>
            <p className="text-xs text-slate-500">{detailRequest.type === "ENTRY" ? "ENTRADA" : "SALIDA"} · {detailRequest.branch} · {detailRequest.requestedBy}</p>
          </div>
        </div>
        <button type="button" onClick={() => setDetailRequest(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Cerrar"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 bg-white space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><span className="mb-1 block text-[11px] font-medium text-slate-500">Tipo</span><span className={`block text-sm font-bold ${detailRequest.type === "ENTRY" ? "text-emerald-700" : "text-rose-700"}`}>{detailRequest.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><span className="mb-1 block text-[11px] font-medium text-slate-500">Sucursal</span><span className="flex items-center gap-1 truncate text-sm font-bold text-slate-800"><Building2 className="h-3.5 w-3.5 shrink-0 text-[#5750f1]" /><span className="truncate">{detailRequest.branch}</span></span></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><span className="mb-1 block text-[11px] font-medium text-slate-500">Solicitante</span><span className="flex items-center gap-1 truncate text-sm font-bold text-slate-800"><UserRound className="h-3.5 w-3.5 shrink-0 text-[#5750f1]" /><span className="truncate">{detailRequest.requestedBy}</span></span></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><span className="mb-1 block text-[11px] font-medium text-slate-500">Estado</span><span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${detailRequest.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : detailRequest.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{detailRequest.status === "PENDING" ? "PENDIENTE" : detailRequest.status === "APPROVED" ? "APROBADA" : "RECHAZADA"}</span></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><span className="mb-1 block text-[11px] font-medium text-slate-500">Motivo / referencia</span><p className="text-sm font-semibold text-slate-800">{detail.reason || "Sin motivo"}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays className="h-3 w-3" />Creada el {formatRequestDate(detailRequest.createdAt)}</p></div>
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800"><Boxes className="h-4 w-4 text-[#5750f1]" />Productos a {detailRequest.type === "ENTRY" ? "entrar" : "sacar"} ({items.length})</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2.5 font-bold">Código</th><th className="px-4 py-2.5 font-bold">Producto</th><th className="px-4 py-2.5 font-bold">Presentación</th><th className="px-4 py-2.5 text-right font-bold">Unidades</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{items.map((item: RequestItem) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-mono text-xs font-bold text-[#5750f1]">{item.product?.code ?? "—"}</td><td className="px-4 py-3 font-semibold text-slate-800"><span className="block">{item.product?.brand ? `${item.product.brand} · ` : ""}{item.product?.name ?? item.productId}</span><span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-700">{item.product?.capacity ? <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5"><Cpu className="h-3 w-3 text-emerald-600" />Capacidad: {item.product.capacity}</span> : null}<span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5"><Palette className="h-3 w-3 text-indigo-500" />Color: {item.product?.color || "—"}</span></span></td><td className="px-4 py-3 text-xs text-slate-600">{formatItemPresentation(item, detail.itemsMap[item.productId])}</td><td className="px-4 py-3 text-right font-bold text-slate-800">{item.unitsCount} uds</td></tr>)}</tbody>
            </table>
            {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Esta solicitud no tiene productos registrados.</p>}
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setVoucherRequest(detailRequest)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50"><Printer className="h-4 w-4" />Ver boucher</button>
          {isAdmin && detailRequest.status === "PENDING" && <>
            <button type="button" disabled={!!updatingId} onClick={() => { setDetailRequest(null); void update(detailRequest.id, "APPROVED"); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Aprobar</button>
            <button type="button" disabled={!!updatingId} onClick={() => { setDetailRequest(null); void update(detailRequest.id, "REJECTED"); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"><XCircle className="h-4 w-4" />Rechazar</button>
          </>}
        </div>
        <button type="button" onClick={() => setDetailRequest(null)} className="rounded-xl bg-[#5750f1] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5750f1]/20 transition hover:bg-[#463ec5]">Entendido</button>
      </div>
    </div></div>; })()}
    {voucherRequest && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-label={`Voucher de ${voucherRequest.requestCode}`}><div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6 pb-4"><div><p className={`text-xs font-bold ${voucherRequest.type === "ENTRY" ? "text-emerald-600" : "text-rose-600"}`}>BOUCHER DE SOLICITUD</p><h2 className="text-xl font-black text-slate-900">{voucherRequest.requestCode}</h2><p className="mt-1 text-xs text-slate-500">{voucherRequest.branch} · {voucherRequest.requestedBy}</p></div><button type="button" onClick={() => setVoucherRequest(null)} className="-mr-2 -mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar voucher"><X className="h-5 w-5" /></button></div><div className="space-y-2 p-6 pt-4">{(voucherRequest.items ?? []).map((item: RequestItem) => <div key={item.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span><strong>{item.product?.code}</strong> · {formatProductLabel(item.product, item.productId)}</span><strong>{item.unitsCount} uds</strong></div>)}</div><div className="mx-6 flex justify-between border-t border-slate-200 pt-3 text-sm font-black"><span>{voucherRequest.type === "ENTRY" ? "ENTRADA" : "SALIDA"}</span><span>{voucherRequest.status === "PENDING" ? "Esperando aprobación" : voucherRequest.status === "APPROVED" ? "Aprobada" : "Rechazada"}</span></div><div className="flex flex-wrap justify-end gap-2 p-6"><button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"><Printer className="h-4 w-4" />Imprimir / PDF</button><button type="button" disabled={sharingVoucher} onClick={() => void shareVoucherImage(voucherRequest)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{sharingVoucher ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}{sharingVoucher ? "Preparando imagen..." : "Enviar imagen por WhatsApp"}</button></div></div></div>}
  </div>;
}
