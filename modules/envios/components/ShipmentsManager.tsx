"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import {
  Truck,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  ChevronRight,
  Play,
  Pause,
  XCircle,
  User,
  History,
  Calendar,
  ExternalLink,
  Layers,
  ArrowLeft,
  X,
  Compass,
  Radio,
  Share2,
} from "lucide-react";
import type { Shipment, ShipmentStop } from "@/modules/envios/types";
import { GpsTracker } from "./GpsTracker";
import type { PlannedRoute } from "./ShipmentMap";

const ShipmentMap = dynamic(
  () => import("./ShipmentMap").then((module) => module.ShipmentMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] sm:h-[460px] lg:h-[540px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <Navigation className="h-6 w-6 animate-spin text-indigo-600" />
          <span>Cargando mapa interactivo…</span>
        </div>
      </div>
    ),
  }
);

const statusConfig: Record<
  Shipment["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  DRAFT: { label: "Borrador", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  READY: { label: "Listo para salir", bg: "bg-sky-50 border border-sky-200", text: "text-sky-700", dot: "bg-sky-500" },
  IN_TRANSIT: { label: "En tránsito", bg: "bg-indigo-50 border border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-600" },
  PAUSED: { label: "Pausado", bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  DELIVERED: { label: "Entregado", bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-600" },
  CANCELLED: { label: "Cancelado", bg: "bg-rose-50 border border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

type Driver = { id: string; name: string | null; username: string | null };
type Address = { id: string; name: string; address: string; mapsUrl: string | null; isDefaultOrigin: boolean };
type Props = {
  initialShipments: Shipment[];
  drivers: Driver[];
  addresses: Address[];
  currentUserId: string;
};
type ShipmentForm = {
  title: string;
  destination: string;
  destinationAddressId: string;
  stopAddressIds: string[];
  driverId: string;
  notes: string;
};

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-DO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Santo_Domingo",
      }).format(new Date(value))
    : "Sin registrar";
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return "Sin datos";
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return "Hace un momento";
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
  return formatDateTime(dateString);
}

export function ShipmentsManager({ initialShipments, drivers, addresses, currentUserId }: Props) {
  const emptyForm = (): ShipmentForm => ({
    title: "",
    destination: "",
    destinationAddressId: "",
    stopAddressIds: [],
    driverId: drivers.find((d) => d.id === currentUserId)?.id ?? "",
    notes: "",
  });

  const [shipments, setShipments] = useState(initialShipments);
  const [historyShipments, setHistoryShipments] = useState<Shipment[] | null>(null);
  const [view, setView] = useState<"active" | "history">("active");
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? null);
  const [form, setForm] = useState<ShipmentForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"list" | "detail">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [routeShipmentId, setRouteShipmentId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [cancelPromptId, setCancelPromptId] = useState<string | null>(null);

  const visibleShipments = view === "active" ? shipments : historyShipments ?? [];

  // Filtered shipments based on search & filter
  const filteredShipments = useMemo(() => {
    return visibleShipments.filter((shipment) => {
      if (statusFilter !== "ALL" && shipment.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const codeMatch = shipment.code.toLowerCase().includes(q);
      const titleMatch = shipment.title.toLowerCase().includes(q);
      const destMatch = shipment.destination.toLowerCase().includes(q);
      const driverMatch = shipment.driver?.name?.toLowerCase().includes(q) || shipment.driver?.username?.toLowerCase().includes(q);
      const stopsMatch = shipment.stops.some((s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
      return codeMatch || titleMatch || destMatch || driverMatch || stopsMatch;
    });
  }, [visibleShipments, searchQuery, statusFilter]);

  const selected = visibleShipments.find((shipment) => shipment.id === selectedId) ?? null;
  const routeStartKey = selected?.lastLocation?.recordedAt ?? null;
  const destinationAddresses = addresses.filter((address) => !address.isDefaultOrigin);

  // Counters
  const inTransitCount = shipments.filter((s) => s.status === "IN_TRANSIT").length;
  const readyCount = shipments.filter((s) => s.status === "READY").length;
  const pausedCount = shipments.filter((s) => s.status === "PAUSED").length;

  const removeTerminalShipment = (shipmentId: string) => {
    setShipments((current) => current.filter((shipment) => shipment.id !== shipmentId));
    setSelectedId((current) => (current === shipmentId ? "" : current));
  };

  useEffect(() => {
    if (view !== "history" || historyShipments) return;
    void fetch("/api/envios?history=true", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as { shipments: Shipment[] };
      setHistoryShipments(data.shipments);
      if (!selectedId && data.shipments.length > 0) {
        setSelectedId(data.shipments[0]?.id ?? null);
      }
    });
  }, [view, historyShipments, selectedId]);

  // Live polling for selected active shipment
  useEffect(() => {
    if (view === "history") return;
    if (!selectedId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/envios/${selectedId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { shipment: Shipment };
      if (["DELIVERED", "CANCELLED"].includes(data.shipment.status)) {
        removeTerminalShipment(data.shipment.id);
        return;
      }
      setShipments((current) =>
        current.map((shipment) => (shipment.id === data.shipment.id ? data.shipment : shipment))
      );
    }, 10000);
    return () => window.clearInterval(timer);
  }, [selectedId, view]);

  // Calculate route when selected shipment or coordinates change
  useEffect(() => {
    if (!selectedId || view === "history") return;
    let cancelled = false;
    void fetch(`/api/envios/${selectedId}/route`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as PlannedRoute & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setRoute(null);
          setRouteShipmentId(selectedId);
          setRouteError(data.error ?? "No se pudo calcular la ruta.");
          return;
        }
        setRoute(data);
        setRouteShipmentId(selectedId);
        setRouteError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setRouteShipmentId(selectedId);
          setRouteError("No se pudo calcular la ruta.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, routeStartKey, view]);

  const toggleStopAddress = (id: string) => {
    const nextIds = form.stopAddressIds.includes(id)
      ? form.stopAddressIds.filter((item) => item !== id)
      : [...form.stopAddressIds, id];
    const selectedAddresses = destinationAddresses.filter((address) => nextIds.includes(address.id));
    setForm((current) => ({
      ...current,
      stopAddressIds: nextIds,
      title:
        selectedAddresses.length > 0
          ? selectedAddresses.map((address) => address.name).join(" · ")
          : current.title,
      destination:
        selectedAddresses.length === 1
          ? selectedAddresses[0].address
          : selectedAddresses.length > 1
          ? `Ruta de ${selectedAddresses.length} paradas`
          : current.destination,
    }));
  };

  const createShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    const response = await fetch("/api/envios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setCreating(false);
    if (!response.ok) {
      window.alert(data.error ?? "No se pudo crear el envío.");
      return;
    }
    setShipments((current) => [data.shipment, ...current]);
    setSelectedId(data.shipment.id);
    setForm(emptyForm());
    setIsModalOpen(false);
    setMobileTab("detail");
  };

  const updateStatus = async (status: Shipment["status"]) => {
    if (!selected) return;
    setIsUpdatingStatus(true);
    const response = await fetch(`/api/envios/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setIsUpdatingStatus(false);
    if (!response.ok) {
      window.alert("No se pudo actualizar el estado del envío.");
      return;
    }
    const data = (await response.json()) as { shipment: Shipment };
    if (["DELIVERED", "CANCELLED"].includes(data.shipment.status)) {
      removeTerminalShipment(data.shipment.id);
      return;
    }
    setShipments((current) =>
      current.map((shipment) => (shipment.id === data.shipment.id ? data.shipment : shipment))
    );
  };

  const selectShipment = (id: string) => {
    setSelectedId(id);
    setMobileTab("detail");
  };

  const displayedRoute = routeShipmentId === selectedId ? route : null;
  const displayedRouteMessage =
    routeShipmentId === selectedId && routeError ? routeError : "Esperando primera ubicación GPS…";
  const autoDestination = displayedRoute?.returnToOrigin
    ? displayedRoute.destination
    : selected?.stops.length === 0
    ? displayedRoute?.destination ?? null
    : null;
  const activeSelected = view === "active" && selected;

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-3 sm:px-6 py-2 sm:py-4">
      {/* Top Header Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-indigo-700">
              Operaciones Logísticas
            </span>
            {inTransitCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                {inTransitCount} en ruta
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Envíos y Seguimiento en Vivo
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Rastreo satelital GPS, cálculo inteligente de rutas y validación de paradas en tiempo real.
          </p>
        </div>

        {/* Global Action & Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setView("active");
                setSelectedId(shipments[0]?.id ?? null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === "active"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Navigation className="h-3.5 w-3.5" />
              En curso ({shipments.length})
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === "history"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Historial ({historyShipments?.length ?? "…"})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo envío</span>
          </button>
        </div>
      </div>

      {/* KPI Chips Bar */}
      {view === "active" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">En Tránsito</span>
              <p className="text-lg font-black text-slate-900">{inTransitCount}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Listos para salir</span>
              <p className="text-lg font-black text-slate-900">{readyCount}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Pause className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">En pausa</span>
              <p className="text-lg font-black text-slate-900">{pausedCount}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Total viajes</span>
              <p className="text-lg font-black text-slate-900">{shipments.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher (Visible on small & medium screens) */}
      <div className="flex xl:hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileTab("list")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
            mobileTab === "list"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Lista de viajes ({filteredShipments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("detail")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
            mobileTab === "detail"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Navigation className="h-3.5 w-3.5" />
          <span>Mapa & Detalle {selected ? `(${selected.code})` : ""}</span>
        </button>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Column: Shipments List & Quick Filters */}
        <section
          className={`space-y-4 ${
            mobileTab === "detail" ? "hidden xl:block" : "block"
          }`}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, conductor o destino..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            {view === "active" && (
              <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "IN_TRANSIT", label: "En ruta" },
                  { id: "READY", label: "Listos" },
                  { id: "PAUSED", label: "Pausados" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 font-bold transition ${
                      statusFilter === f.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cards List */}
          <div className="space-y-2.5">
            {filteredShipments.map((shipment) => {
              const isSelected = selectedId === shipment.id;
              const status = statusConfig[shipment.status] ?? statusConfig.DRAFT;
              const completedStops = shipment.stops.filter((s) => s.status === "ARRIVED").length;
              const totalStops = shipment.stops.length;

              return (
                <article
                  key={shipment.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectShipment(shipment.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectShipment(shipment.id);
                    }
                  }}
                  className={`group relative w-full cursor-pointer rounded-2xl border p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500/30"
                      : "border-slate-200 bg-white hover:border-indigo-200"
                  }`}
                >
                  {/* Left Active Accent Bar */}
                  {isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r bg-indigo-600" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-indigo-600">
                          {shipment.code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.bg} ${status.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}></span>
                          {status.label}
                        </span>
                      </div>

                      <h2 className="mt-1.5 font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-600 transition">
                        {shipment.title}
                      </h2>

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {totalStops > 0 ? `${totalStops} paradas en ruta` : shipment.destination}
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      className={`h-4 w-4 shrink-0 mt-1 transition ${
                        isSelected ? "text-indigo-600 translate-x-0.5" : "text-slate-300 group-hover:text-slate-500"
                      }`}
                    />
                  </div>

                  {/* Multi-stop progress bar */}
                  {totalStops > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                        <span>Progreso de paradas</span>
                        <span className="font-bold text-slate-700">
                          {completedStops}/{totalStops} completadas
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{
                            width: `${totalStops > 0 ? (completedStops / totalStops) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer card info: Driver & Signal */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium truncate">
                        {shipment.driver?.name || shipment.driver?.username || "Sin asignar"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 shrink-0">
                      <Radio className="h-3 w-3 text-emerald-500" />
                      <span>{formatRelativeTime(shipment.lastLocation?.recordedAt ?? null)}</span>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Empty States */}
            {filteredShipments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
                <Truck className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-bold text-slate-700">No se encontraron envíos</p>
                <p className="mt-1 text-xs text-slate-500">
                  {searchQuery
                    ? "Intenta con otro término de búsqueda o limpia los filtros."
                    : view === "history"
                    ? "Todavía no hay envíos en el historial."
                    : "No hay envíos activos actualmente. Crea uno nuevo para comenzar."}
                </p>
                {view === "active" && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear primer envío
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Tracking, Map & Operations */}
        <section
          className={`min-w-0 space-y-4 ${
            mobileTab === "list" ? "hidden xl:block" : "block"
          }`}
        >
          {/* Mobile Back button */}
          <div className="xl:hidden">
            <button
              type="button"
              onClick={() => setMobileTab("list")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a la lista de envíos
            </button>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
              {/* Trip Header & Controls */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {selected.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        statusConfig[selected.status].bg
                      } ${statusConfig[selected.status].text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusConfig[selected.status].dot}`}
                      ></span>
                      {statusConfig[selected.status].label}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-black text-slate-900">
                    {selected.title}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>
                      {selected.stops.length > 0
                        ? `Ruta multi-parada con ${selected.stops.length} destinos`
                        : `Destino: ${selected.destination}`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      Conductor asignado:{" "}
                      <strong className="text-slate-700">
                        {selected.driver?.name || selected.driver?.username || "Sin asignar"}
                      </strong>
                    </span>
                  </p>
                </div>

                {/* Status Action Buttons */}
                {view === "active" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.status === "READY" && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => void updateStatus("IN_TRANSIT")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Iniciar viaje</span>
                      </button>
                    )}

                    {selected.status === "IN_TRANSIT" && (
                      <>
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => void updateStatus("PAUSED")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 active:scale-95 transition disabled:opacity-50"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pausar viaje</span>
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => void updateStatus("DELIVERED")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Completar entrega</span>
                        </button>
                      </>
                    )}

                    {selected.status === "PAUSED" && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => void updateStatus("IN_TRANSIT")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Reanudar viaje</span>
                      </button>
                    )}

                    {["READY", "IN_TRANSIT", "PAUSED"].includes(selected.status) && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => setCancelPromptId(selected.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Cancelar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* History Stats Cards */}
              {view === "history" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Inicio de ruta
                    </span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900">
                      {formatDateTime(selected.startedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Finalización
                    </span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900">
                      {formatDateTime(selected.deliveredAt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-indigo-600" /> Puntos GPS
                    </span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900">
                      {selected.locations.length} coordenadas
                    </p>
                  </div>
                </div>
              )}

              {/* Paradas (Stops) Stepper Section */}
              {selected.stops.length > 0 && (
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {view === "history" ? "Paradas Realizadas" : "Paradas Programadas"}
                    </span>
                    {displayedRoute?.returnToOrigin && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        Retorno al origen incluido
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {selected.stops.map((stop, index) => {
                      const isArrived = stop.status === "ARRIVED";
                      const routeStop = displayedRoute?.stops.find((item) => item.id === stop.id);

                      return (
                        <div
                          key={stop.id}
                          className={`rounded-xl p-3 border transition-all ${
                            isArrived
                              ? "bg-emerald-50/50 border-emerald-200"
                              : "bg-white border-slate-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                  isArrived
                                    ? "bg-emerald-600 text-white"
                                    : "bg-indigo-600 text-white"
                                }`}
                              >
                                {isArrived ? "✓" : index + 1}
                              </span>
                              <p className="text-xs font-bold text-slate-900">{stop.name}</p>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isArrived
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {isArrived
                                ? "Completada"
                                : routeStop
                                ? `${routeStop.distanceKm} km · ${routeStop.durationMinutes} min`
                                : "Pendiente"}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-1 pl-7">
                            {stop.address}
                          </p>

                          <div className="mt-2 flex items-center justify-between pl-7">
                            {stop.arrivedAt ? (
                              <span className="text-[10px] font-semibold text-emerald-700">
                                Llegada: {formatDateTime(stop.arrivedAt)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Detección automática por GPS
                              </span>
                            )}

                            {/* Direct Navigation Link for Drivers */}
                            {stop.mapsUrl ? (
                              <a
                                href={stop.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Abrir GPS
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Map & GPS HUD */}
              <div className="space-y-3">
                <ShipmentMap shipment={selected} route={view === "active" ? displayedRoute : null} />

                {/* Driver GPS Tracker HUD if assigned to current user */}
                {activeSelected ? (
                  <GpsTracker
                    shipmentId={selected.id}
                    active={
                      selected.driver?.id === currentUserId &&
                      ["READY", "IN_TRANSIT", "PAUSED"].includes(selected.status)
                    }
                    destination={autoDestination}
                    onDelivered={() => removeTerminalShipment(selected.id)}
                  />
                ) : null}
              </div>

              {/* Live Telemetry KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block">Puntos GPS</span>
                  <p className="mt-0.5 text-base font-black text-slate-900">
                    {selected.locations.length}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block">Última Señal</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-900">
                    {selected.lastLocation
                      ? new Date(selected.lastLocation.recordedAt).toLocaleTimeString("es-DO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Sin señal"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block">Distancia</span>
                  <p className="mt-0.5 text-xs font-bold text-indigo-600">
                    {displayedRoute ? `${displayedRoute.distanceKm} km` : "--"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 block">Tiempo Est.</span>
                  <p className="mt-0.5 text-xs font-bold text-indigo-600">
                    {displayedRoute
                      ? displayedRoute.durationMinutes >= 60
                        ? `${Math.floor(displayedRoute.durationMinutes / 60)}h ${
                            displayedRoute.durationMinutes % 60
                          }m`
                        : `${displayedRoute.durationMinutes} min`
                      : "--"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Navigation className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">Ningún envío seleccionado</p>
              <p className="mt-1 text-xs text-slate-500">
                Selecciona un viaje de la lista para ver su trazado satelital y estadísticas.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* New Shipment Modal */}
      {isModalOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs animate-in fade-in duration-150"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !creating) setIsModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Crear Nuevo Envío</h2>
                  <p className="text-xs text-slate-500">
                    Configura las paradas y asigna el conductor responsable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={createShipment} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título o Código del Pedido *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Pedido #4023 - Repuestos Santo Domingo"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Multi-stop selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Paradas Guardadas
                </label>
                {destinationAddresses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay direcciones guardadas.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1.5 divide-y divide-slate-100">
                    {destinationAddresses.map((address) => {
                      const isChecked = form.stopAddressIds.includes(address.id);
                      return (
                        <label
                          key={address.id}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition ${
                            isChecked ? "bg-indigo-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStopAddress(address.id)}
                            className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-900">
                              {address.name}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              {address.address}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-500">
                  Las paradas se completan automáticamente por geocerca GPS al llegar.
                </p>
              </div>

              {/* Custom Destination (if no stops selected) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección Destino Manual {form.stopAddressIds.length === 0 && "*"}
                </label>
                <input
                  required={form.stopAddressIds.length === 0}
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder={
                    form.stopAddressIds.length > 0
                      ? "Paradas seleccionadas arriba"
                      : "Ej: Av. 27 de Febrero esq. Lincoln, Santo Domingo"
                  }
                  readOnly={form.stopAddressIds.length > 0}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none read-only:bg-slate-50 focus:border-indigo-500"
                />
              </div>

              {/* Driver Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Conductor Asignado *
                </label>
                <select
                  required
                  value={form.driverId}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">Selecciona un conductor...</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name || driver.username || driver.id}
                      {driver.id === currentUserId ? " (Tú)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {creating ? "Creando envío…" : "Guardar y Crear Envío"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelPromptId && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCancelPromptId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">¿Cancelar este envío?</h2>
              <p className="mt-1 text-xs text-slate-500">
                El viaje se marcará como cancelado y se detendrá el rastreo GPS.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelPromptId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateStatus("CANCELLED");
                  setCancelPromptId(null);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
              >
                Sí, cancelar envío
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
