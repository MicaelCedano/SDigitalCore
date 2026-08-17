"use client";

import { useEffect, useRef, useState } from "react";

export function GpsTracker({ shipmentId, active }: { shipmentId: string; active: boolean }) {
  const watchId = useRef<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState("GPS detenido");

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  const stop = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
    setMessage("GPS detenido");
  };

  const start = () => {
    if (!navigator.geolocation) { setMessage("Este dispositivo no ofrece GPS."); return; }
    setMessage("Solicitando ubicación…");
    watchId.current = navigator.geolocation.watchPosition(async (position) => {
      const payload = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, speedMps: position.coords.speed, heading: position.coords.heading, recordedAt: new Date(position.timestamp).toISOString() };
      const response = await fetch(`/api/envios/${shipmentId}/locations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (response.ok) { setTracking(true); setMessage(`Última posición enviada ${new Date().toLocaleTimeString("es-DO")}`); }
      else { const data = await response.json().catch(() => null); setMessage(data?.error ?? "No se pudo enviar la ubicación."); }
    }, (error) => setMessage(error.message || "No se pudo obtener la ubicación."), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  };

  if (!active) return null;
  return <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={tracking ? stop : start} className={`rounded-xl px-3 py-2 text-xs font-bold ${tracking ? "bg-rose-100 text-rose-700" : "bg-indigo-600 text-white"}`}>{tracking ? "Detener GPS" : "Activar GPS"}</button><span className="text-xs text-slate-500">{message}</span></div>;
}
