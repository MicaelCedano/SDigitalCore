import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { QcSuppliersManager } from "@/modules/configuracion/components/QcSuppliersManager";

export const metadata: Metadata = {
  title: "Proveedores de control de calidad | SDigitalCore",
  description: "Catálogo de proveedores exclusivo para Compras y Control de Calidad",
};

export default async function QcSuppliersPage() {
  await requirePermission("settings.read");
  try {
    const suppliers = await prisma.qcSupplier.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        contactName: true,
        phone: true,
        email: true,
        notes: true,
        status: true,
      },
    });
    return <QcSuppliersManager initialSuppliers={suppliers} databaseReady />;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return <QcSuppliersManager initialSuppliers={[]} databaseReady={false} />;
    }
    throw error;
  }
}
