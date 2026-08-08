import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import {
  ArrowRight,
  FileText,
  Settings,
  Tag,
  Warehouse,
} from "lucide-react";

export const metadata: Metadata = { title: "Resumen general" };

const operations = [
  { label: "Almacén", href: "/almacen", moduleKey: "almacen", icon: Warehouse },
];

const commercial = [
  { label: "Lista de precios", href: "/precios", moduleKey: "precios", icon: Tag },
  { label: "Facturas", href: "/facturas", moduleKey: "facturas", icon: FileText },
];

const administration = [
  { label: "Configuración", href: "/configuracion", moduleKey: "configuracion", icon: Settings },
];

const groups = [
  {
    title: "Operaciones",
    description: "Mercancía, movimientos, solicitudes y conteos persistidos.",
    icon: Warehouse,
    items: operations,
  },
  {
    title: "Comercial",
    description: "Precios y documentos comerciales conectados a la base central.",
    icon: FileText,
    items: commercial,
  },
  {
    title: "Administración",
    description: "Información consolidada y control del sistema.",
    icon: Settings,
    items: administration,
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const persistedUser = user
    ? await prisma.user.findFirst({
        where: user.id ? { id: user.id } : { email: user.email ?? "" },
        select: { roleCode: true, allowedModules: true },
      })
    : null;
  const allowedModuleSet =
    persistedUser?.roleCode === "ADMIN"
      ? null
      : new Set(persistedUser?.allowedModules ?? []);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => allowedModuleSet === null || allowedModuleSet.has(item.moduleKey),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const hour = Number(
    new Date().toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false,
    }),
  );
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] ?? "usuario";

  return (
    <div className="mx-auto max-w-[1200px] space-y-7">
      <section>
        <h2 className="text-3xl font-bold tracking-[-0.035em] text-[#101828] sm:text-[34px]">{greeting}, {firstName}</h2>
        <p className="mt-2 text-[15px] text-[#667085] sm:text-base">Controla las operaciones clave de SDigital desde un solo lugar.</p>
      </section>

      <section className="enterprise-panel overflow-hidden" aria-labelledby="operations-title">
        <div className="border-b border-[#e4e7ec] px-5 py-5 sm:px-6">
          <h3 id="operations-title" className="text-lg font-semibold tracking-[-0.02em] text-[#101828]">Centro de operaciones</h3>
          <p className="mt-1 text-sm text-[#667085]">Accede rápidamente a los módulos según tu flujo de trabajo.</p>
        </div>

        <div className="divide-y divide-[#e4e7ec]">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.title} className="grid lg:grid-cols-[270px_1fr]">
                <div className="flex gap-4 border-b border-[#e4e7ec] bg-[#fcfcfd] p-5 lg:border-b-0 lg:border-r lg:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]">
                    <GroupIcon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-[#101828]">{group.title}</h4>
                    <p className="mt-1 text-[13px] leading-5 text-[#667085]">{group.description}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2">
                  {group.items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex min-h-[58px] items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#344054] outline-none transition-colors hover:bg-[#f8fafc] hover:text-[#4338ca] focus-visible:bg-[#eef2ff] ${
                          index % 2 === 0 ? "sm:border-r sm:border-[#f0f1f3]" : ""
                        } ${index >= 2 ? "border-t border-[#f0f1f3]" : ""}`}
                      >
                        <Icon size={19} strokeWidth={1.75} className="shrink-0 text-[#475467] group-hover:text-[#4f46e5]" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ArrowRight size={16} className="shrink-0 text-[#98a2b3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
