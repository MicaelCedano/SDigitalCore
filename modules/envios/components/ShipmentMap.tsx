"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useCallback } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation, Compass, CheckCircle2, MapPin, RotateCcw } from "lucide-react";
import type { Shipment } from "@/modules/envios/types";

export type RouteStop = {
  id: string;
  name: string;
  address: string;
  status: "PENDING" | "ARRIVED";
  latitude: number;
  longitude: number;
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][];
  destination: { latitude: number; longitude: number; label: string };
};

export type PlannedRoute = {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  destination: { latitude: number; longitude: number; label: string };
  stops: RouteStop[];
  returnToOrigin: boolean;
};

// Custom icons with sleek styling
const vehicleIcon = L.divIcon({
  className: "shipment-vehicle-marker",
  html: `
    <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(79,70,229,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:relative;width:38px;height:38px;border-radius:50%;background:#4f46e5;border:3px solid #ffffff;box-shadow:0 10px 25px -5px rgba(79,70,229,0.5),0 8px 10px -6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;">
        🚐
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function createStopIcon(index: number, isArrived: boolean, isNext: boolean) {
  const bg = isArrived ? "#10b981" : isNext ? "#4f46e5" : "#64748b";
  const ring = isNext ? "0 0 0 6px rgba(79,70,229,0.25)" : "0 4px 12px rgba(0,0,0,0.25)";
  const icon = isArrived ? "✓" : `${index + 1}`;
  return L.divIcon({
    className: "shipment-stop-marker",
    html: `
      <div style="width:32px;height:32px;border-radius:50%;background:${bg};border:3px solid #ffffff;box-shadow:${ring};display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:13px;font-weight:800;font-family:sans-serif;">
        ${icon}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const destinationIcon = L.divIcon({
  className: "shipment-destination-marker",
  html: `
    <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ea580c;border:3px solid white;box-shadow:0 6px 16px rgba(234,88,12,0.4);display:flex;align-items:center;justify-content:center;">
      <div style="width:10px;height:10px;border-radius:50%;background:white;transform:rotate(45deg);"></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

function MapControls({ shipment, route }: { shipment: Shipment; route: PlannedRoute | null }) {
  const map = useMap();
  const current = shipment.lastLocation;

  const centerVehicle = useCallback(() => {
    if (current) {
      map.flyTo([current.latitude, current.longitude], 15, { duration: 1 });
    }
  }, [current, map]);

  const fitRoute = useCallback(() => {
    if (route?.coordinates.length) {
      map.fitBounds(L.latLngBounds(route.coordinates), { padding: [40, 40] });
    } else if (shipment.locations.length > 1) {
      map.fitBounds(L.latLngBounds(shipment.locations.map((p) => [p.latitude, p.longitude])), { padding: [40, 40] });
    }
  }, [map, route, shipment.locations]);

  useEffect(() => {
    if (current && shipment.status === "IN_TRANSIT") {
      map.panTo([current.latitude, current.longitude], { animate: true });
    } else if (route?.coordinates.length) {
      map.fitBounds(L.latLngBounds(route.coordinates), { padding: [35, 35] });
    }
  }, [current, map, route, shipment.status]);

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      {current ? (
        <button
          type="button"
          onClick={centerVehicle}
          title="Centrar en el vehículo"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50 active:scale-95"
        >
          <Navigation className="h-4 w-4 text-indigo-600" />
        </button>
      ) : null}
      {route?.coordinates.length || shipment.locations.length > 1 ? (
        <button
          type="button"
          onClick={fitRoute}
          title="Ver ruta completa"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50 active:scale-95"
        >
          <Compass className="h-4 w-4 text-slate-700" />
        </button>
      ) : null}
    </div>
  );
}

export function ShipmentMap({ shipment, route }: { shipment: Shipment; route: PlannedRoute | null }) {
  const actualPoints = shipment.locations.map((point) => [point.latitude, point.longitude] as [number, number]);
  const center: [number, number] = route?.coordinates[0] ?? (shipment.lastLocation ? [shipment.lastLocation.latitude, shipment.lastLocation.longitude] : [18.4221107, -68.9676383]);
  const stopRoutes = (route?.stops ?? []).filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} h ${m > 0 ? `${m} m` : ""}`;
    }
    return `${minutes} min`;
  };

  return (
    <div className="relative h-[360px] sm:h-[460px] lg:h-[540px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapControls shipment={shipment} route={route} />

        {/* Planned Route Line */}
        {route ? (
          <Polyline
            positions={route.coordinates}
            pathOptions={{ color: "#4f46e5", weight: 7, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
          />
        ) : null}

        {/* Intermediate Stop Secondary Paths */}
        {stopRoutes.slice(1).map((stop) => (
          <Polyline
            key={stop.id}
            positions={stop.coordinates}
            pathOptions={{ color: "#93c5fd", weight: 4, opacity: 0.7, dashArray: "6 8" }}
          />
        ))}

        {/* Real Traveled History Path */}
        {actualPoints.length > 1 ? (
          <Polyline
            positions={actualPoints}
            pathOptions={{ color: "#0f172a", weight: 4, opacity: 0.85, lineCap: "round", lineJoin: "round" }}
          />
        ) : null}

        {/* Destination Marker */}
        {route ? (
          <Marker position={[route.destination.latitude, route.destination.longitude]} icon={destinationIcon}>
            <Popup className="rounded-xl shadow-lg">
              <div className="p-1">
                <span className="inline-block rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                  {route.returnToOrigin ? "Regreso al Centro" : "Destino Final"}
                </span>
                <p className="mt-1 font-bold text-slate-900">{route.destination.label}</p>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {/* Stops Markers */}
        {stopRoutes.map((stop, idx) => {
          const isArrived = stop.status === "ARRIVED";
          const isNext = !isArrived && (idx === 0 || stopRoutes[idx - 1]?.status === "ARRIVED");
          return (
            <Marker key={stop.id} position={[stop.latitude, stop.longitude]} icon={createStopIcon(idx, isArrived, isNext)}>
              <Popup className="rounded-xl shadow-lg">
                <div className="p-1">
                  <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isArrived ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
                    {isArrived ? "✓ Parada Completada" : `Parada #${idx + 1}`}
                  </span>
                  <p className="mt-1 font-bold text-slate-900">{stop.name}</p>
                  <p className="text-xs text-slate-500">{stop.address}</p>
                  {!isArrived && (
                    <p className="mt-2 text-xs font-semibold text-indigo-600">
                      Aprox. {stop.distanceKm} km · {stop.durationMinutes} min
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Real-time Vehicle Marker */}
        {shipment.lastLocation ? (
          <Marker
            position={[shipment.lastLocation.latitude, shipment.lastLocation.longitude]}
            icon={vehicleIcon}
          >
            <Popup className="rounded-xl shadow-lg">
              <div className="p-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-mono text-xs font-bold text-indigo-600">{shipment.code}</span>
                </div>
                <p className="mt-1 font-bold text-slate-900">
                  {shipment.driver?.name || shipment.driver?.username || "Conductor en ruta"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Último reporte: {new Date(shipment.lastLocation.recordedAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>

      {/* Floating Info Pill overlay (compact on mobile) */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:top-3 sm:bottom-auto z-[1000] max-w-sm rounded-2xl border border-white/60 bg-white/95 p-3.5 shadow-xl backdrop-blur-md transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            {route?.returnToOrigin ? "Regreso a Base" : "Próximo Destino"}
          </span>
          {route && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {formatTime(route.durationMinutes)}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs sm:text-sm font-bold text-slate-900">
          {route?.destination.label ?? shipment.destination}
        </p>
        {route ? (
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500">Distancia</span>
              <p className="font-extrabold text-slate-900">{route.distanceKm} km</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500">Tiempo est.</span>
              <p className="font-extrabold text-indigo-600">{formatTime(route.durationMinutes)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">
            {shipment.lastLocation ? "Calculando ruta..." : "El conductor debe activar el GPS."}
          </p>
        )}
      </div>
    </div>
  );
}
