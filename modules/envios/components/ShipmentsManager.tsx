"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Shipment } from "@/modules/envios/types";
import { GpsTracker } from "./GpsTracker";
import type { PlannedRoute } from "./ShipmentMap";

const ShipmentMap = dynamic(() => import("./ShipmentMap").then((module) => module.ShipmentMap), { ssr: false, loading: () => <div className="flex h-[430px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">Cargando mapa…</div> });
const statusLabels: Record<Shipment["status"], string> = { DRAFT: "Borrador", READY: "Listo", IN_TRANSIT: "En tránsito", PAUSED: "Pausado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
type Driver = { id: string; name: string | null; username: string | null };
type Address = { id: string; name: string; address: string; mapsUrl: string | null; isDefaultOrigin: boolean };
type Props = { initialShipments: Shipment[]; drivers: Driver[]; addresses: Address[]; currentUserId: string };
type ShipmentForm = { title: string; destination: string; destinationAddressId: string; vehicleLabel: string; driverId: string; notes: string };

export function ShipmentsManager({ initialShipments, drivers, addresses, currentUserId }: Props) {
  const emptyForm = (): ShipmentForm => ({ title: "", destination: "", destinationAddressId: "", vehicleLabel: "", driverId: "", notes: "" });
  const [shipments, setShipments] = useState(initialShipments);
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? null);
  const [form, setForm] = useState<ShipmentForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [routeShipmentId, setRouteShipmentId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/envios/${selectedId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { shipment: Shipment };
      setShipments((current) => current.map((shipment) => shipment.id === data.shipment.id ? data.shipment : shipment));
    }, 10000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void fetch(`/api/envios/${selectedId}/route`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as PlannedRoute & { error?: string };
      if (cancelled) return;
      if (!response.ok) { setRouteShipmentId(selectedId); setRouteError(data.error ?? "No se pudo calcular la ruta."); return; }
      setRoute(data); setRouteShipmentId(selectedId); setRouteError(null);
    }).catch(() => { if (!cancelled) { setRouteShipmentId(selectedId); setRouteError("No se pudo calcular la ruta."); } });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selectDestination = (id: string) => {
    const address = addresses.find((item) => item.id === id);
    setForm((current) => ({ ...current, destinationAddressId: id, destination: address?.address ?? "" }));
  };

  const createShipment = async (event: React.FormEvent) => {
    event.preventDefault(); setCreating(true);
    const response = await fetch("/api/envios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json(); setCreating(false);
    if (!response.ok) { window.alert(data.error ?? "No se pudo crear el envío."); return; }
    setShipments((current) => [data.shipment, ...current]); setSelectedId(data.shipment.id); setForm(emptyForm());
  };

  const updateStatus = async (status: Shipment["status"]) => {
    if (!selected) return;
    const response = await fetch(`/api/envios/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return;
    const data = await response.json() as { shipment: Shipment };
    setShipments((current) => current.map((shipment) => shipment.id === data.shipment.id ? data.shipment : shipment));
  };

  const displayedRoute = routeShipmentId === selectedId ? route : null;
  const displayedRouteMessage = routeShipmentId === selectedId && routeError ? routeError : "Calculando ruta desde Yacelltech…";
  return <main className="mx-auto max-w-[1500px] space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Operaciones</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Envíos y seguimiento</h1><p className="mt-2 text-sm text-slate-500">Crea una ruta desde Yacelltech y sigue el vehículo dentro de República Dominicana.</p></div><div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><section className="space-y-4"><form onSubmit={createShipment} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-bold text-slate-900">Nuevo envío</h2><p className="mt-1 text-xs text-slate-500">Origen fijo: Yacelltech</p><div className="mt-3 space-y-2"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Título del pedido" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><select value={form.destinationAddressId} onChange={(event) => selectDestination(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Destino guardado (opcional)</option>{addresses.filter((address) => !address.isDefaultOrigin).map((address) => <option key={address.id} value={address.id}>{address.name}</option>)}</select><input required value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Destino" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><input value={form.vehicleLabel} onChange={(event) => setForm({ ...form, vehicleLabel: event.target.value })} placeholder="Vehículo / placa" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><select value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Asignar conductor</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.username || driver.id}</option>)}</select><button disabled={creating} className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{creating ? "Creando…" : "Crear envío"}</button></div></form><div className="space-y-2">{shipments.map((shipment) => <button type="button" key={shipment.id} onClick={() => setSelectedId(shipment.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === shipment.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-indigo-600">{shipment.code}</p><p className="mt-1 font-bold text-slate-900">{shipment.title}</p><p className="mt-1 text-xs text-slate-500">Yacelltech → {shipment.destination}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabels[shipment.status]}</span></div></button>)}{shipments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía no hay envíos.</div> : null}</div></section><section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{selected ? <><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-indigo-600">{selected.code}</p><h2 className="mt-1 text-xl font-black text-slate-900">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">Yacelltech → {selected.destination}</p><p className="mt-1 text-xs text-slate-500">Conductor: {selected.driver?.name || selected.driver?.username || "Sin asignar"}</p></div><select value={selected.status} onChange={(event) => void updateStatus(event.target.value as Shipment["status"])} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"><option value="READY">Listo</option><option value="IN_TRANSIT">En tránsito</option><option value="PAUSED">Pausado</option><option value="DELIVERED">Entregado</option><option value="CANCELLED">Cancelado</option></select></div><div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">Ruta planificada</p><p className="mt-1 text-sm font-semibold text-slate-900">Yacelltech → {selected.destination}</p></div>{displayedRoute ? <div className="ml-auto flex gap-4 text-right"><div><p className="text-[11px] text-slate-500">Distancia</p><p className="font-black text-slate-900">{displayedRoute.distanceKm} km</p></div><div><p className="text-[11px] text-slate-500">Tiempo estimado</p><p className="font-black text-slate-900">{displayedRoute.durationMinutes >= 60 ? `${Math.floor(displayedRoute.durationMinutes / 60)} h ${displayedRoute.durationMinutes % 60} min` : `${displayedRoute.durationMinutes} min`}</p></div></div> : <p className="ml-auto text-xs text-orange-700">{displayedRouteMessage}</p>}</div><ShipmentMap shipment={selected} route={displayedRoute} /><GpsTracker shipmentId={selected.id} active={selected.driver?.id === currentUserId && ["READY", "IN_TRANSIT", "PAUSED"].includes(selected.status)} /><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Puntos registrados</p><p className="mt-1 text-xl font-black text-slate-900">{selected.locations.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Última actualización</p><p className="mt-1 text-sm font-bold text-slate-900">{selected.lastLocation ? new Date(selected.lastLocation.recordedAt).toLocaleTimeString("es-DO") : "Sin GPS"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Estado</p><p className="mt-1 text-sm font-bold text-slate-900">{statusLabels[selected.status]}</p></div></div></> : <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500">Selecciona un envío para ver su mapa.</div>}</section></div></main>;
}
