"use client";

import { useState } from "react";
import {
  Loader2,
  Lock,
  CheckCircle2,
  XCircle,
  Wallet,
  Package,
  User,
  Search,
  RefreshCw,
  Coins,
  FileText,
} from "lucide-react";
import { approveUnlockRequestAction, getUnlockRequestsAction, searchUnlockRecordAction } from "@/modules/desbloqueos/actions/unlocks";

export function UnlockAdminPanel({ initialRequests }: { initialRequests: any[] }) {
  const [requests, setRequests] = useState<any[]>(initialRequests || []);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [searchImei, setSearchImei] = useState("");
  const [record, setRecord] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  async function refresh() {
    setBusy(true);
    const res = await getUnlockRequestsAction();
    if (res.success) setRequests(res.data as any[]);
    setBusy(false);
  }

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setPendingId(requestId);
    setPendingAction(action);
    setMessage("");
    const res = await approveUnlockRequestAction({ requestId, action });
    setPendingId(null);
    setPendingAction(null);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return;
    }
    setMessageTone("ok");
    setMessage(
      action === "approve"
        ? `Solicitud ${res.data.requestCode} aprobada: RD$ ${res.data.montoTotal.toLocaleString("es-DO")} acreditados al técnico.`
        : `Solicitud ${res.data.requestCode} rechazada.`
    );
    await refresh();
  }

  async function handleSearch() {
    const imei = searchImei.trim();
    if (!imei) return;
    setSearching(true);
    setRecord(null);
    const res = await searchUnlockRecordAction(imei);
    setSearching(false);
    if (!res.success) {
      setMessageTone("error");
      setMessage(res.error);
      return;
    }
    setRecord(res.data);
  }

  const statusBadge = (status: string) =>
    status === "APPROVED" ? (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">APROBADO</span>
    ) : status === "REJECTED" ? (
      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">RECHAZADO</span>
    ) : (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">PENDIENTE ADMIN</span>
    );

  const formatDate = (value: string | Date | null) =>
    value ? new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" }) : "—";

  const pending = requests.filter((r) => r.status === "PENDING_ADMIN");
  const history = requests.filter((r) => r.status !== "PENDING_ADMIN");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Solicitudes de Desbloqueo</h1>
          <p className="text-xs text-slate-500 mt-0.5">Aprobar y pagar RD$25 por IMEI al técnico</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-xl border p-4 text-sm font-medium ${
            messageTone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </p>
      )}

      {/* Pendientes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500" /> Por aprobar y pagar
          </h2>
          <span className="text-[11px] font-bold text-slate-400">{pending.length} pendiente(s)</span>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-300" />
            <p className="text-xs font-semibold">No hay solicitudes pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((req: any) => (
              <div key={req.id} className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-[#5750f1]">{req.requestCode}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {req.technician?.name || req.technician?.username}
                    </span>
                    <span className="font-semibold text-slate-700">{req.model}</span>
                    <span className="text-slate-400">{formatDate(req.createdAt)}</span>
                  </div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    {((req.imeis as Array<{ imei: string }>) || []).map((item, index) => (
                      <span key={index} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                        <SmartphoneIcon /> {item.imei}
                      </span>
                    ))}
                  </div>
                  {req.observacion && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500 italic">
                      <FileText className="w-3 h-3 shrink-0 mt-0.5" /> "{req.observacion}"
                    </p>
                  )}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Wallet className="w-3.5 h-3.5" />
                      Balance wallet:
                      <span className="font-bold text-emerald-600">
                        RD$ {Number(req.technician?.wallet?.balance ?? 0).toLocaleString("es-DO")}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-black text-slate-800">
                        Total: RD$ {(req.totalEquipos * 25).toLocaleString("es-DO")}
                      </span>
                      <span className="text-slate-400">({req.totalEquipos} × RD$25)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, "reject")}
                        disabled={pendingId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {pendingId === req.id && pendingAction === "reject" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, "approve")}
                        disabled={pendingId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-[11px] font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {pendingId === req.id && pendingAction === "approve" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Aprobar y pagar RD$ {(req.totalEquipos * 25).toLocaleString("es-DO")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5750f1]/10 text-[#5750f1]">
              <Search className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Historial por IMEI</h2>
              <p className="text-[11px] text-slate-500">Busca un IMEI para ver quién lo desbloqueó y cuándo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={searchImei}
              onChange={(event) => setSearchImei(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder="IMEI (15 dígitos)"
              className="h-10 w-52 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-[#5750f1] focus:ring-2 focus:ring-[#5750f1]/10"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#5750f1] px-4 text-[11px] font-bold text-white transition hover:bg-[#463ec5] disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Buscar
            </button>
          </div>
        </div>

        {record && (
          <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
            {record ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <span className="font-mono font-bold text-slate-800">{record.imei}</span>
                <span className="text-slate-600">{record.model}</span>
                <span className="flex items-center gap-1 text-slate-600">
                  <User className="w-3 h-3" /> {record.technician?.name || record.technician?.username || "—"}
                </span>
                <span className="text-slate-500">Pagado: {formatDate(record.paidAt)}</span>
                <span className="font-mono text-[#5750f1]">{record.request?.requestCode}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">DESBLOQUEADO</span>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No se encontró ningún desbloqueo para ese IMEI.</p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Técnico</th>
                  <th className="px-5 py-3">Modelo</th>
                  <th className="px-5 py-3">Equipos</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Pagado</th>
                  <th className="px-5 py-3 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-[#5750f1]">{req.requestCode}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{req.technician?.name || req.technician?.username}</td>
                    <td className="px-5 py-3 text-slate-600">{req.model}</td>
                    <td className="px-5 py-3 text-slate-600">{req.totalEquipos}</td>
                    <td className="px-5 py-3">{statusBadge(req.status)}</td>
                    <td className="px-5 py-3 font-bold text-emerald-600">RD$ {Number(req.montoTotalPagado).toLocaleString("es-DO")}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{formatDate(req.approvedAt || req.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SmartphoneIcon() {
  return <Lock className="w-3 h-3 text-slate-400" />;
}
