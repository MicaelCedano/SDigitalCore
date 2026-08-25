"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation, Radio, CheckCircle2, AlertTriangle, ShieldCheck, Gauge } from "lucide-react";

const trackingStorageKey = (shipmentId: string) => `sdigitalcore:shipment-gps:${shipmentId}`;
const ARRIVAL_RADIUS_METERS = 120;
type Destination = { latitude: number; longitude: number } | null;

function distanceInMeters(latitude: number, longitude: number, destination: Destination) {
  if (!destination) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(destination.latitude - latitude);
  const deltaLongitude = toRadians(destination.longitude - longitude);
  const originLatitude = toRadians(latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function GpsTracker({
  shipmentId,
  active,
  destination,
  onDelivered,
}: {
  shipmentId: string;
  active: boolean;
  destination: Destination;
  onDelivered: () => void;
}) {
  const watchId = useRef<number | null>(null);
  const destinationRef = useRef(destination);
  const onDeliveredRef = useRef(onDelivered);
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState("GPS detenido");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    destinationRef.current = destination;
    onDeliveredRef.current = onDelivered;
  }, [destination, onDelivered]);

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    window.localStorage.removeItem(trackingStorageKey(shipmentId));
    setTracking(false);
    setMessage("GPS detenido");
  };

  const start = () => {
    if (!navigator.geolocation) {
      setErrorStatus("Este dispositivo o navegador no soporta geolocalización.");
      console.warn("[GPS] Geolocalización no disponible en este dispositivo");
      return;
    }
    if (watchId.current !== null) return;
    setErrorStatus(null);
    window.localStorage.setItem(trackingStorageKey(shipmentId), "active");
    setTracking(true);
    setMessage("Buscando señal satelital GPS…");
    console.info("[GPS] Iniciando rastreo automático", shipmentId);

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const coords = position.coords;
        setAccuracy(Math.round(coords.accuracy));
        setSpeed(coords.speed ? Math.round(coords.speed * 3.6) : null); // km/h

        const payload = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: coords.accuracy,
          speedMps: coords.speed,
          heading: coords.heading,
          recordedAt: new Date(position.timestamp).toISOString(),
        };

        const response = await fetch(`/api/envios/${shipmentId}/locations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        const locationResult = (await response.json().catch(() => null)) as { delivered?: boolean; error?: string } | null;

        if (!response.ok) {
          setErrorStatus(locationResult?.error ?? "Error al sincronizar coordenadas.");
          return;
        }

        const nowFormatted = new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastPing(nowFormatted);
        setMessage("Transmitiendo ubicación en vivo");

        if (locationResult?.delivered) {
          stopTracking();
          setMessage("¡Pedido entregado con éxito!");
          onDeliveredRef.current();
          return;
        }

        const distance = distanceInMeters(coords.latitude, coords.longitude, destinationRef.current);
        if (distance <= ARRIVAL_RADIUS_METERS) {
          const deliveredResponse = await fetch(`/api/envios/${shipmentId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "DELIVERED" }),
          });

          if (deliveredResponse.ok) {
            stopTracking();
            setMessage("¡Llegada confirmada! Viaje completado.");
            onDeliveredRef.current();
          }
        }
      },
      (error) => {
        window.localStorage.removeItem(trackingStorageKey(shipmentId));
        setTracking(false);
        let errorMsg = "No se pudo obtener la ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Permiso de ubicación denegado. Habilítalo en tu navegador móvil.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Señal GPS no disponible. Verifica que tu GPS esté encendido.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Tiempo de espera de GPS agotado. Reintentando...";
        }
        console.warn("[GPS] No se pudo obtener la ubicación", error.code);
        setErrorStatus(errorMsg);
      },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
    );
  };

  useEffect(() => {
    if (!active) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      window.localStorage.removeItem(trackingStorageKey(shipmentId));
      return;
    }
    const autoStartTimer = window.setTimeout(start, 0);

    return () => {
      window.clearTimeout(autoStartTimer);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, shipmentId]);

  if (!active) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            {tracking ? (
              <>
                <Radio className="h-5 w-5 animate-pulse text-white" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                  <span className="h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75"></span>
                  <span className="absolute h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
              </>
            ) : (
              <Navigation className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                Panel del Conductor (GPS en vivo)
              </span>
              {tracking && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Transmitiendo
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-700">
              {errorStatus ? (
                <span className="text-rose-600 font-bold">{errorStatus}</span>
              ) : (
                message
              )}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {tracking ? (
            <button
              type="button"
              onClick={stopTracking}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition"
            >
              Detener GPS
            </button>
          ) : errorStatus ? (
            <button
              type="button"
              onClick={start}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition"
            >
              <Radio className="h-4 w-4" />
              Reintentar GPS
            </button>
          ) : null}
        </div>
      </div>

      {/* Driver Telemetry Bar (Shown when active) */}
      {tracking && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-indigo-100 pt-3 text-center">
          <div className="rounded-xl bg-white/80 p-2 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 block">Precisión</span>
            <span className="text-xs font-black text-slate-800">
              {accuracy !== null ? `±${accuracy}m` : "Calibrando"}
            </span>
          </div>
          <div className="rounded-xl bg-white/80 p-2 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 block">Velocidad</span>
            <span className="text-xs font-black text-indigo-700">
              {speed !== null ? `${speed} km/h` : "0 km/h"}
            </span>
          </div>
          <div className="rounded-xl bg-white/80 p-2 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 block">Último Ping</span>
            <span className="text-xs font-black text-slate-800">
              {lastPing ?? "Enviando..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
