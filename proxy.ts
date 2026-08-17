import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;

  // Rutas públicas — no requieren autenticación
  const isPublicRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/descargas") ||
    nextUrl.pathname.startsWith("/solicitar-acceso") ||
    nextUrl.pathname.startsWith("/recuperar-password") ||
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname.startsWith("/api/downloads/");

  if (isPublicRoute) {
    // Si ya está logueado y va al login, redirigir al dashboard
    if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Ruta raíz → redirigir a dashboard o login
  if (nextUrl.pathname === "/") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Rutas protegidas — exigir sesión
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
