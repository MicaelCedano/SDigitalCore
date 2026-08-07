import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = { title: "Resumen general" };

const operations = [
  { label: "Inventario", href: "/inventario", icon: Package },
  { label: "Almacén", href: "/almacen", icon: Warehouse },
  { label: "Taller", href: "/taller", icon: Wrench },
  { label: "RMA / Garantías", href: "/rma", icon: ShieldCheck },
  { label: "Control QC", href: "/qc", icon: CheckCircle2 },
];

const commercial = [
  { label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Proveedores", href: "/proveedores", icon: Truck },
  { label: "Lista de precios", href: "/precios", icon: Tag },
  { label: "Facturas", href: "/facturas", icon: FileText },
];

const administration = [
  { label: "Reportes", href: "/reportes", icon: BarChart3 },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

const groups = [
  {
    title: "Operaciones",
    description: "Inventario, almacén, taller y calidad en cada etapa.",
    icon: Package,
    items: operations,
  },
  {
    title: "Comercial",
    description: "Ventas, clientes, proveedores y documentos comerciales.",
    icon: ShoppingCart,
    items: commercial,
  },
  {
    title: "Administración",
    description: "Información consolidada y control del sistema.",
    icon: BarChart3,
    items: administration,
  },
];

const workflow = [
  { label: "Ventas", description: "Registra la operación", icon: ShoppingCart },
  { label: "Inventario", description: "Verifica disponibilidad", icon: Package },
  { label: "Almacén", description: "Prepara y despacha", icon: Warehouse },
  { label: "Taller", description: "Repara y da seguimiento", icon: Wrench },
  { label: "Control QC", description: "Valida la calidad", icon: CheckCircle2 },
  { label: "RMA", description: "Gestiona garantías", icon: ShieldCheck },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
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
          {groups.map((group) => {
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

      <section className="enterprise-panel px-5 py-5 sm:px-6 sm:py-6" aria-labelledby="workflow-title">
        <h3 id="workflow-title" className="text-lg font-semibold tracking-[-0.02em] text-[#101828]">Flujo operativo</h3>
        <p className="mt-1 text-sm text-[#667085]">Vista general de cómo se conectan los módulos principales.</p>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.label} className="relative flex gap-3 lg:block">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#344054]">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                {index < workflow.length - 1 ? <span className="absolute left-10 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-[#d0d5dd] lg:block" /> : null}
                <div className="lg:mt-3">
                  <p className="text-[13px] font-semibold text-[#101828]">{step.label}</p>
                  <p className="mt-0.5 text-xs leading-[18px] text-[#667085]">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
