import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SDigitalCore — Sistema de Gestión",
    short_name: "SDigitalCore",
    description:
      "Sistema integral de gestión para inventario, ventas, taller, RMA y más.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "es",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    shortcuts: [
      {
        name: "Ventas",
        short_name: "Ventas",
        description: "Módulo de ventas y facturación",
        url: "/ventas",
        icons: [{ src: "/logo.png", sizes: "any" }],
      },
      {
        name: "Inventario",
        short_name: "Inventario",
        description: "Control de stock y productos",
        url: "/inventario",
        icons: [{ src: "/logo.png", sizes: "any" }],
      },
      {
        name: "Taller",
        short_name: "Taller",
        description: "Órdenes de servicio y reparaciones",
        url: "/taller",
        icons: [{ src: "/logo.png", sizes: "any" }],
      },
      {
        name: "Clientes",
        short_name: "Clientes",
        description: "Directorio y balance de clientes",
        url: "/clientes",
        icons: [{ src: "/logo.png", sizes: "any" }],
      },
    ],
  };
}

