import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | SDigitalCore",
    default: "SDigitalCore — Sistema de Gestión",
  },
  description:
    "Sistema integral de gestión para inventario, ventas, taller, RMA y más.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: false, // Sistema privado — no indexar
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
