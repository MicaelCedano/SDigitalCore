import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { StockCountsList } from "@/modules/almacen/components/StockCountsList";

export const metadata: Metadata = {
  title: "Auditorías de Stock | SDigitalCore",
  description: "Auditoría física de inventario de almacén, verificación de existencias y comparación de esperado vs. contado",
};

export default async function ConteosPage() {
  const user = await getCurrentUser();
  const persistedUser = user
    ? await prisma.user.findFirst({
        where: user.id ? { id: user.id } : { email: user.email ?? "" },
        select: { roleCode: true },
      })
    : null;

  return <StockCountsList roleCode={persistedUser?.roleCode || "USER"} />;
}

