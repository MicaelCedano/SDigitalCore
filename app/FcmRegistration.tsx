"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type FcmModule = typeof import("tauri-plugin-fcm");

export function FcmRegistration() {
  const started = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const publicRoutes = ["/login", "/recuperar-password", "/solicitar-acceso"];
    if (
      started.current ||
      publicRoutes.includes(pathname) ||
      !("__TAURI_INTERNALS__" in window)
    ) return;
    started.current = true;

    let unregisterRefresh: (() => Promise<void>) | undefined;

    const register = async () => {
      const fcm: FcmModule = await import("tauri-plugin-fcm");
      let permission = await fcm.checkPermissions();
      if (permission === "prompt" || permission === "prompt-with-rationale") {
        permission = await fcm.requestPermissions();
      }
      if (permission !== "granted") return;

      await fcm.createChannel({
        id: "sdigitalcore",
        name: "SDigitalCore",
        importance: 4,
      });
      await fcm.register();

      const sendToken = async (token: string) => {
        await fetch("/api/mobile/push-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, platform: "ANDROID", appVersion: "0.1.0" }),
        });
      };

      const { token } = await fcm.getToken();
      await sendToken(token);

      const listener = await fcm.onTokenRefresh((event) => {
        void sendToken(event.token);
      });
      unregisterRefresh = () => listener.unregister();
    };

    void register().catch((error) => {
      console.error("[FCM] No se pudo registrar el dispositivo", error);
    });

    return () => {
      void unregisterRefresh?.();
    };
  }, []);

  return null;
}
