"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Shipment } from "@/modules/envios/types";
import { GpsTracker } from "./GpsTracker";
import type { PlannedRoute } from "./ShipmentMap";

const ShipmentMap = dynamic(() => import("./ShipmentMap").then((module) => module.ShipmentMap), { ssr: false, loading: () => <div className="flex h-[430px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">Cargando mapa…</div> });
const statusLabels: Record<Shipment["status"], string> = { DRAFT: "Borrador", READY: "Listo", IN_TRANSIT: "En tránsito", PAUSED: "Pausado", DELIVERED: "Pedido entregado", CANCELLED: "Cancelado" };
type Driver = { id: string; name: string | null; username: string | null };
type Address = { id: string; name: string; address: string; mapsUrl: string | null; isDefaultOrigin: boolean };
type Props = { initialShipments: Shipment[]; drivers: Driver[]; addresses: Address[]; currentUserId: string };
type ShipmentForm = { title: string; destination: string; destinationAddressId: string; stopAddressIds: string[]; driverId: string; notes: string };

export function ShipmentsManager({ initialShipments, drivers, addresses, currentUserId }: Props) {
  const emptyForm = (): ShipmentForm => ({ title: "", destination: "", destinationAddressId: "", stopAddressIds: [], driverId: "", notes: "" });
  const [shipments, setShipments] = useState(initialShipments);
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? null);
  const [form, setForm] = useState<ShipmentForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [routeShipmentId, setRouteShipmentId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? null;
  const routeStartKey = selected?.lastLocation?.recordedAt ?? null;
  const destinationAddresses = addresses.filter((address) => !address.isDefaultOrigin);

  const removeTerminalShipment = (shipmentId: string) => {
    setShipments((current) => current.filter((shipment) => shipment.id !== shipmentId));
    setSelectedId((current) => current === shipmentId ? "" : current);
  };

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/envios/${selectedId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { shipment: Shipment };
      if (["DELIVERED", "CANCELLED"].includes(data.shipment.status)) { removeTerminalShipment(data.shipment.id); return; }
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
      if (!response.ok) { setRoute(null); setRouteShipmentId(selectedId); setRouteError(data.error ?? "No se pudo calcular la ruta."); return; }
      setRoute(data); setRouteShipmentId(selectedId); setRouteError(null);
    }).catch(() => { if (!cancelled) { setRouteShipmentId(selectedId); setRouteError("No se pudo calcular la ruta."); } });
    return () => { cancelled = true; };
  }, [selectedId, routeStartKey]);

  const toggleStopAddress = (id: string) => {
    const nextIds = form.stopAddressIds.includes(id) ? form.stopAddressIds.filter((item) => item !== id) : [...form.stopAddressIds, id];
    const selectedAddresses = destinationAddresses.filter((address) => nextIds.includes(address.id));
    setForm((current) => ({ ...current, stopAddressIds: nextIds, title: selectedAddresses.length > 0 ? selectedAddresses.map((address) => address.name).join(" · ") : current.title, destination: selectedAddresses.length === 1 ? selectedAddresses[0].address : selectedAddresses.length > 1 ? `Ruta de ${selectedAddresses.length} paradas` : current.destination }));
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
    if (!response.ok) { window.alert("No se pudo actualizar el viaje."); return; }
    const data = await response.json() as { shipment: Shipment };
    if (["DELIVERED", "CANCELLED"].includes(data.shipment.status)) { removeTerminalShipment(data.shipment.id); return; }
    setShipments((current) => current.map((shipment) => shipment.id === data.shipment.id ? data.shipment : shipment));
  };

  const displayedRoute = routeShipmentId === selectedId ? route : null;
  const displayedRouteMessage = routeShipmentId === selectedId && routeError ? routeError : "Esperando la primera ubicación GPS…";
  const autoDestination = displayedRoute?.returnToOrigin ? displayedRoute.destination : selected?.stops.length === 0 ? displayedRoute?.destination ?? null : null;

  return <main className="mx-auto max-w-[1500px] space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Operaciones</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Envíos y seguimiento</h1><p className="mt-2 text-sm text-slate-500">Las paradas se completan automáticamente al llegar; no tienen un orden fijo.</p></div>
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-4">
        <form onSubmit={createShipment} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-bold text-slate-900">Nuevo envío</h2><p className="mt-1 text-xs text-slate-500">Selecciona las paradas. El conductor puede llegar a cualquiera y el sistema la marcará completada.</p><div className="mt-3 space-y-3"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Título del pedido" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /><fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-xs font-bold text-slate-500">Paradas guardadas</legend>{destinationAddresses.length === 0 ? <p className="text-xs text-slate-500">No hay direcciones guardadas disponibles.</p> : <div className="space-y-2">{destinationAddresses.map((address) => <label key={address.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.stopAddressIds.includes(address.id)} onChange={() => toggleStopAddress(address.id)} className="mt-0.5 h-4 w-4 accent-indigo-600" /><span><span className="font-semibold">{address.name}</span><span className="block text-xs text-slate-500">{address.address}</span></span></label>)}</div>}<p className="mt-2 text-[11px] text-slate-500">No se define orden: se completan según la llegada real.</p></fieldset><input required={form.stopAddressIds.length === 0} value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder={form.stopAddressIds.length > 0 ? "Paradas seleccionadas" : "Dirección del destino"} readOnly={form.stopAddressIds.length > 0} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none read-only:bg-slate-50 focus:border-indigo-500" /><select required value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Asignar conductor (usará su GPS)</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.username || driver.id}</option>)}</select><button disabled={creating} className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{creating ? "Creando…" : "Crear envío"}</button></div></form>
        <div className="space-y-2">{shipments.map((shipment) => <button type="button" key={shipment.id} onClick={() => setSelectedId(shipment.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === shipment.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-indigo-600">{shipment.code}</p><p className="mt-1 font-bold text-slate-900">{shipment.title}</p><p className="mt-1 text-xs text-slate-500">{shipment.stops.length > 0 ? `${shipment.stops.length} paradas` : shipment.destination}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabels[shipment.status]}</span></div></button>)}{shipments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía no hay envíos activos.</div> : null}</div>
      </section>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{selected ? <>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-indigo-600">{selected.code}</p><h2 className="mt-1 text-xl font-black text-slate-900">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">{selected.stops.length > 0 ? "Ruta con paradas automáticas" : `Destino: ${selected.destination}`}</p><p className="mt-1 text-xs text-slate-500">GPS del conductor: {selected.driver?.name || selected.driver?.username || "Sin asignar"}</p></div><div className="flex flex-wrap gap-2"><select value={selected.status} onChange={(event) => void updateStatus(event.target.value as Shipment["status"])} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"><option value="READY">Listo</option><option value="IN_TRANSIT">En tránsito</option><option value="PAUSED">Pausado</option><option value="DELIVERED">Pedido entregado</option><option value="CANCELLED">Cancelado</option></select>{["READY", "IN_TRANSIT", "PAUSED"].includes(selected.status) ? <><button type="button" onClick={() => void updateStatus("DELIVERED")} className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">Terminar viaje</button><button type="button" onClick={() => void updateStatus("CANCELLED")} className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">Cancelar viaje</button></> : null}</div></div>
        {selected.stops.length > 0 ? <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Paradas automáticas</p>{displayedRoute?.returnToOrigin ? <span className="text-xs font-bold text-emerald-700">Regreso a Yacelltech</span> : null}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.stops.map((stop) => { const routeStop = displayedRoute?.stops.find((item) => item.id === stop.id); return <div key={stop.id} className="rounded-xl bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-900">{stop.name}</p><span className={`text-[10px] font-bold ${stop.status === "ARRIVED" ? "text-emerald-700" : "text-blue-700"}`}>{stop.status === "ARRIVED" ? "Completada" : routeStop ? `${routeStop.distanceKm} km · ${routeStop.durationMinutes} min` : "Pendiente"}</span></div><p className="mt-1 text-xs text-slate-500">{stop.address}</p></div>; })}</div></div> : null}
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">{displayedRoute?.returnToOrigin ? "Regreso final" : "Ruta al destino"}</p><p className="mt-1 text-sm font-semibold text-slate-900">{displayedRoute?.destination.label ?? selected.destination}</p></div>{displayedRoute ? <div className="ml-auto flex gap-4 text-right"><div><p className="text-[11px] text-slate-500">Tiempo estimado</p><p className="font-black text-slate-900">{displayedRoute.durationMinutes >= 60 ? `${Math.floor(displayedRoute.durationMinutes / 60)} h ${displayedRoute.durationMinutes % 60} min` : `${displayedRoute.durationMinutes} min`}</p></div><div><p className="text-[11px] text-slate-500">Distancia</p><p className="font-black text-slate-900">{displayedRoute.distanceKm} km</p></div></div> : <p className="ml-auto text-xs text-orange-700">{displayedRouteMessage}</p>}</div>
        <ShipmentMap shipment={selected} route={displayedRoute} /><GpsTracker shipmentId={selected.id} active={selected.driver?.id === currentUserId && ["READY", "IN_TRANSIT", "PAUSED"].includes(selected.status)} destination={autoDestination} onDelivered={() => removeTerminalShipment(selected.id)} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Puntos registrados</p><p className="mt-1 text-xl font-black text-slate-900">{selected.locations.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Última actualización</p><p className="mt-1 text-sm font-bold text-slate-900">{selected.lastLocation ? new Date(selected.lastLocation.recordedAt).toLocaleTimeString("es-DO") : "Sin GPS"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Estado</p><p className="mt-1 text-sm font-bold text-slate-900">{statusLabels[selected.status]}</p></div></div>
      </> : <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500">Selecciona un envío para ver su mapa.</div>}</section>
    </div>
  </main>;
}
