"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Shipment } from "@/modules/envios/types";

export type PlannedRoute = { coordinates: [number, number][]; distanceKm: number; durationMinutes: number; destination: { latitude: number; longitude: number; label: string } };

const vehicleIcon = L.divIcon({ className: "shipment-vehicle-icon", html: '<div style="width:34px;height:34px;border-radius:50%;background:#4f46e5;border:4px solid white;box-shadow:0 5px 18px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font-size:18px">🚐</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
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
  return <div className="h-[430px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"><MapContainer center={center} zoom={10} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitRoute shipment={shipment} route={route} />{route ? <Polyline positions={route.coordinates} pathOptions={{ color: "#f97316", weight: 6, opacity: 0.85, dashArray: "10 8" }} /> : null}{actualPoints.length > 1 ? <Polyline positions={actualPoints} pathOptions={{ color: "#4f46e5", weight: 5, opacity: 0.9 }} /> : null}{route ? <Marker position={[route.destination.latitude, route.destination.longitude]} icon={destinationIcon}><Popup><strong>Destino</strong><br />{route.destination.label}</Popup></Marker> : null}{shipment.lastLocation ? <Marker position={[shipment.lastLocation.latitude, shipment.lastLocation.longitude]} icon={vehicleIcon}><Popup><strong>{shipment.code}</strong><br />Furgoneta en ruta<br />Última posición: {new Date(shipment.lastLocation.recordedAt).toLocaleString("es-DO")}</Popup></Marker> : null}</MapContainer></div>;
}
