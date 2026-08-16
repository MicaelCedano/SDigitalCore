"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FcmModule = typeof import("tauri-plugin-fcm");

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
    try {
      return JSON.stringify(error);
    } catch {
      return "Error nativo no serializable";
    }
  }
  return String(error);
}

export function FcmRegistration() {
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "registering" | "denied" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pathname = usePathname();

  const registerDevice = useCallback(async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    setStatus("registering");
    setErrorMessage(null);
    started.current = true;

    const register = async () => {
      let stage = "cargando el módulo FCM";
      try {
        const fcm: FcmModule = await import("tauri-plugin-fcm");
        stage = "consultando el permiso de notificaciones";
        let permission = await fcm.checkPermissions();
        if (permission === "prompt" || permission === "prompt-with-rationale") {
          stage = "solicitando el permiso de notificaciones";
          permission = await fcm.requestPermissions();
        }
        if (permission !== "granted") {
          started.current = false;
          setStatus("denied");
          return;
        }

        stage = "creando el canal de notificaciones";
        await fcm.createChannel({
          id: "sdigitalcore",
          name: "SDigitalCore",
          importance: 4,
        });
        stage = "inicializando FCM";
        await fcm.register();

        const sendToken = async (token: string) => {
          await fetch("/api/mobile/push-token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token, platform: "ANDROID", appVersion: "0.1.1" }),
          });
        };

        stage = "obteniendo el token FCM";
        const { token } = await fcm.getToken();
        stage = "registrando el dispositivo en SDigitalCore";
        await sendToken(token);

        await fcm.onTokenRefresh((event) => {
          void sendToken(event.token);
        });
        setStatus("success");
      } catch (error) {
        const detail = describeError(error);
        throw new Error(`${stage}: ${detail}`);
      }
    };

    await register().catch((error) => {
      started.current = false;
      setStatus("error");
      setErrorMessage(describeError(error));
      console.error("[FCM] No se pudo registrar el dispositivo", error);
    });
  }, []);

  useEffect(() => {
    const publicRoutes = ["/login", "/recuperar-password", "/solicitar-acceso"];
    if (
      started.current ||
      publicRoutes.includes(pathname) ||
      !("__TAURI_INTERNALS__" in window)
    ) return;
    void registerDevice();
  }, [pathname, registerDevice]);

  if (
    status === "idle" ||
    status === "success" ||
    ["/login", "/recuperar-password", "/solicitar-acceso"].includes(pathname) ||
    !("__TAURI_INTERNALS__" in (typeof window === "undefined" ? {} : window))
  ) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl sm:left-auto sm:max-w-sm">
      <p className="text-sm font-semibold text-slate-900">
        {status === "registering" ? "Activando notificaciones…" : "Notificaciones sin activar"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {status === "denied"
          ? "Android no concedió el permiso. Toca el botón para intentarlo nuevamente."
          : errorMessage ?? "Activa el permiso para recibir avisos de SDigitalCore."}
      </p>
      {status !== "registering" && (
        <button
          type="button"
          className="mt-3 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => {
            started.current = false;
            void registerDevice();
          }}
        >
          Activar notificaciones
        </button>
      )}
    </div>
  );
}
