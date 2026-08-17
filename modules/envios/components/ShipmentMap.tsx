"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Shipment } from "@/modules/envios/types";

const vehicleIcon = L.divIcon({
  className: "shipment-vehicle-icon",
  html: '<div style="width:34px;height:34px;border-radius:50%;background:#4f46e5;border:4px solid white;box-shadow:0 5px 18px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font-size:17px">🚚</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FollowVehicle({ shipment }: { shipment: Shipment }) {
  const map = useMap();
  const location = shipment.lastLocation;
  useEffect(() => {
    if (location && shipment.status === "IN_TRANSIT") map.panTo([location.latitude, location.longitude], { animate: true });
  }, [location, map, shipment.status]);
  return null;
}

export function ShipmentMap({ shipment }: { shipment: Shipment }) {
  const points = shipment.locations.map((point) => [point.latitude, point.longitude] as [number, number]);
  const current = shipment.lastLocation;
  const center: [number, number] = current ? [current.latitude, current.longitude] : [18.4861, -69.9312];
  return (
    <div className="h-[430px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <MapContainer center={center} zoom={9} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FollowVehicle shipment={shipment} />
        {points.length > 1 ? <Polyline positions={points} pathOptions={{ color: "#4f46e5", weight: 5, opacity: 0.8 }} /> : null}
        {current ? <Marker position={[current.latitude, current.longitude]} icon={vehicleIcon}><Popup><strong>{shipment.code}</strong><br />{shipment.vehicleLabel || "Vehículo"}<br />Última posición: {new Date(current.recordedAt).toLocaleString("es-DO")}</Popup></Marker> : null}
      </MapContainer>
    </div>
  );
}
