import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SDigitalCore — Sistema de Gestión",
    short_name: "SDigitalCore",
    description:
      "Sistema integral de gestión para inventario, ventas, taller, RMA y más.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
