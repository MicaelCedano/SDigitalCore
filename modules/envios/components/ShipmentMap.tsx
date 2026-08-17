"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Shipment } from "@/modules/envios/types";

export type PlannedRoute = { coordinates: [number, number][]; distanceKm: number; durationMinutes: number; destination: { latitude: number; longitude: number; label: string } };

const vehicleIcon = L.divIcon({ className: "shipment-vehicle-icon", html: '<div style="width:42px;height:42px;border-radius:50%;background:#2563eb;border:4px solid white;box-shadow:0 0 0 8px rgba(37,99,235,.18),0 6px 20px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font-size:22px">🚐</div>', iconSize: [42, 42], iconAnchor: [21, 21] });
const destinationIcon = L.divIcon({ className: "shipment-destination-icon", html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f97316;border:3px solid white;box-shadow:0 4px 14px rgba(15,23,42,.3)"><div style="width:8px;height:8px;border-radius:50%;background:white;margin:8px"></div></div>', iconSize: [30, 30], iconAnchor: [15, 27] });

function FitRoute({ shipment, route }: { shipment: Shipment; route: PlannedRoute | null }) {
  const map = useMap();
  const current = shipment.lastLocation;
  useEffect(() => {
    if (current && shipment.status === "IN_TRANSIT") { map.panTo([current.latitude, current.longitude], { animate: true }); return; }
    if (route?.coordinates.length) map.fitBounds(L.latLngBounds(route.coordinates), { padding: [28, 28] });
  }, [current, map, route, shipment.status]);
  return null;
}

export function ShipmentMap({ shipment, route }: { shipment: Shipment; route: PlannedRoute | null }) {
  const actualPoints = shipment.locations.map((point) => [point.latitude, point.longitude] as [number, number]);
  const center: [number, number] = route?.coordinates[0] ?? (shipment.lastLocation ? [shipment.lastLocation.latitude, shipment.lastLocation.longitude] : [18.4221107, -68.9676383]);
  return <div className="relative h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner"><MapContainer center={center} zoom={10} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap contributors &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" /><FitRoute shipment={shipment} route={route} />{route ? <Polyline positions={route.coordinates} pathOptions={{ color: "#2563eb", weight: 8, opacity: 0.95, lineCap: "round", lineJoin: "round" }} /> : null}{actualPoints.length > 1 ? <Polyline positions={actualPoints} pathOptions={{ color: "#0f172a", weight: 5, opacity: 0.85, lineCap: "round", lineJoin: "round" }} /> : null}{route ? <Marker position={[route.destination.latitude, route.destination.longitude]} icon={destinationIcon}><Popup><strong>Destino</strong><br />{route.destination.label}</Popup></Marker> : null}{shipment.lastLocation ? <Marker position={[shipment.lastLocation.latitude, shipment.lastLocation.longitude]} icon={vehicleIcon}><Popup><strong>{shipment.code}</strong><br />Furgoneta en ruta<br />Última posición: {new Date(shipment.lastLocation.recordedAt).toLocaleString("es-DO")}</Popup></Marker> : null}</MapContainer><div className="pointer-events-none absolute left-4 top-4 z-[1000] max-w-[min(330px,calc(100%-2rem))] rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">{shipment.status === "IN_TRANSIT" ? "En ruta" : "Seguimiento"}</p><p className="mt-1 truncate text-sm font-black text-slate-900">{route?.destination.label ?? shipment.destination}</p>{route ? <div className="mt-2 flex gap-4"><div><p className="text-[10px] text-slate-500">Llegada estimada</p><p className="text-lg font-black text-slate-900">{route.durationMinutes >= 60 ? `${Math.floor(route.durationMinutes / 60)} h ${route.durationMinutes % 60} min` : `${route.durationMinutes} min`}</p></div><div><p className="text-[10px] text-slate-500">Distancia</p><p className="text-lg font-black text-slate-900">{route.distanceKm} km</p></div></div> : <p className="mt-1 text-xs text-slate-500">Activa el GPS para dibujar la ruta.</p>}</div></div>;
}
