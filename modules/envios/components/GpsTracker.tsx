"use client";

import { useEffect, useRef, useState } from "react";

const trackingStorageKey = (shipmentId: string) => `sdigitalcore:shipment-gps:${shipmentId}`;
const ARRIVAL_RADIUS_METERS = 120;
type Destination = { latitude: number; longitude: number } | null;

function distanceInMeters(latitude: number, longitude: number, destination: Destination) {
  if (!destination) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = toRadians(destination.latitude - latitude);
  const deltaLongitude = toRadians(destination.longitude - longitude);
  const originLatitude = toRadians(latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function GpsTracker({ shipmentId, active, destination, onDelivered }: { shipmentId: string; active: boolean; destination: Destination; onDelivered: () => void }) {
  const watchId = useRef<number | null>(null);
  const destinationRef = useRef(destination);
  const onDeliveredRef = useRef(onDelivered);
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState("GPS detenido");

  useEffect(() => {
    destinationRef.current = destination;
    onDeliveredRef.current = onDelivered;
  }, [destination, onDelivered]);

  const start = () => {
    if (!navigator.geolocation) { setMessage("Este dispositivo no ofrece GPS."); return; }
    if (watchId.current !== null) return;
    window.localStorage.setItem(trackingStorageKey(shipmentId), "active");
    setTracking(true);
    setMessage("GPS activo; esperando ubicación…");
    watchId.current = navigator.geolocation.watchPosition(async (position) => {
      const payload = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, speedMps: position.coords.speed, heading: position.coords.heading, recordedAt: new Date(position.timestamp).toISOString() };
      const response = await fetch(`/api/envios/${shipmentId}/locations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { const data = await response.json().catch(() => null); setMessage(data?.error ?? "No se pudo enviar la ubicación."); return; }
      const distance = distanceInMeters(position.coords.latitude, position.coords.longitude, destinationRef.current);
      if (distance <= ARRIVAL_RADIUS_METERS) {
        const deliveredResponse = await fetch(`/api/envios/${shipmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "DELIVERED" }) });
        if (deliveredResponse.ok) {
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          window.localStorage.removeItem(trackingStorageKey(shipmentId));
          setTracking(false);
          setMessage("Pedido entregado; GPS apagado.");
          onDeliveredRef.current();
          return;
        }
      }
      setMessage(`Última posición enviada ${new Date().toLocaleTimeString("es-DO")}`);
    }, (error) => { window.localStorage.removeItem(trackingStorageKey(shipmentId)); setTracking(false); setMessage(error.message || "No se pudo obtener la ubicación."); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  };

  useEffect(() => {
    if (!active) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      window.localStorage.removeItem(trackingStorageKey(shipmentId));
      return;
    }
    const resumeTimer = window.localStorage.getItem(trackingStorageKey(shipmentId)) === "active" ? window.setTimeout(start, 0) : undefined;
    return () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      if (!active) window.localStorage.removeItem(trackingStorageKey(shipmentId));
    };
    // El rastreo se conserva mientras el envío esté activo, incluso si se recarga la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, shipmentId]);

  if (!active) return null;
  return <div className="mt-3 flex flex-wrap items-center gap-2">{tracking ? <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">GPS activo</span> : <button type="button" onClick={start} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Activar GPS</button>}<span className="text-xs text-slate-500">{tracking ? `${message} · se apagará al llegar` : message}</span></div>;
}
