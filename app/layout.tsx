import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
  robots: {
    index: false, // Sistema privado — no indexar
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
