import { redirect } from "next/navigation";

/**
 * La raíz redirige al dashboard.
 * El middleware se encarga de redirigir al login si no hay sesión.
 */
export default function RootPage() {
  redirect("/dashboard");
}
