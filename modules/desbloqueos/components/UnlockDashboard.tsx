"use client";

import { useState } from "react";
import {
  Loader2,
  Lock,
  Inbox,
  Plus,
  RefreshCw,
  Coins,
  Wallet,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { getUnlockDashboardAction } from "@/modules/desbloqueos/actions/unlocks";
import { CreateUnlockRequestModal } from "@/modules/desbloqueos/components/CreateUnlockRequestModal";

export function UnlockDashboard({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");

  const refresh = async () => {
    setRefreshing(true);
    setMessage("");
    const res = await getUnlockDashboardAction();
    if (res.success) setData(res.data);
    else setMessage(res.error);
    setRefreshing(false);
  };

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p className="text-xs font-semibold">No se pudo cargar el panel de Desbloqueos.</p>
      </div>
    );
  }

  const statusBadge = (status: string) =>
    status === "APPROVED" ? (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">APROBADO</span>
    ) : status === "REJECTED" ? (
      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">RECHAZADO</span>
    ) : (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">PENDIENTE ADMIN</span>
    );

  const formatDate = (value: string | Date) =>
    new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" });

  const { myRequests, totalPagado, saldoWallet } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Desbloqueos</h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#5750f1]" />
              Solicitudes de desbloqueo · RD$25 por IMEI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2.5 bg-[#5750f1] hover:bg-[#463ec5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#5750f1]/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nueva solicitud
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Solicitudes</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{myRequests?.length ?? 0}</span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Total Pagado</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">RD$ {totalPagado.toLocaleString("es-DO")}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs text-slate-500 block font-medium">Saldo del Wallet</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-[#5750f1]">RD$ {saldoWallet.toLocaleString("es-DO")}</span>
            <div className="p-2 bg-[#5750f1]/10 text-[#5750f1] rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5750f1]" /> Mis solicitudes
          </h2>
          <span className="text-[11px] font-bold text-slate-400">{myRequests?.length ?? 0} solicitud(es)</span>
        </div>

        {!myRequests || myRequests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-16 text-center text-slate-500 space-y-3">
            <Lock className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">Aún no has creado solicitudes</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Usa "Nueva solicitud" para reportar desbloqueos. Al aprobarse, se te pagan RD$25 por IMEI al wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map((req: any) => (
              <div key={req.id} className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-[#5750f1]">{req.requestCode}</span>
                    {statusBadge(req.status)}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span>{formatDate(req.createdAt)}</span>
                    <span className="font-bold text-slate-700">{req.model}</span>
                    <span className="font-black text-emerald-600">
                      {req.status === "APPROVED" ? `RD$ ${Number(req.montoTotalPagado).toLocaleString("es-DO")}` : `RD$ ${(req.totalEquipos * 25).toLocaleString("es-DO")}`}
                    </span>
                  </div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    {((req.imeis as Array<{ imei: string }>) || []).map((item, index) => (
                      <span key={index} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                        <Smartphone className="w-3 h-3 text-slate-400" /> {item.imei}
                      </span>
                    ))}
                  </div>
                  {req.adminObservation && (
                    <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500 italic">
                      {req.status === "REJECTED" ? <XCircle className="inline w-3 h-3 mr-1 text-red-500" /> : <CheckCircle2 className="inline w-3 h-3 mr-1 text-emerald-500" />}
                      {req.adminObservation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateUnlockRequestModal
          onClose={() => setCreateOpen(false)}
          onSubmit={({ requestCode }) => {
            setCreateOpen(false);
            setMessageTone("ok");
            setMessage(`Solicitud ${requestCode} creada. Pendiente de aprobación del administrador.`);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
