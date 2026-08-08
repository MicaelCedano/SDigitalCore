"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireUser } from "@/lib/auth/helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { invoiceSchema, InvoiceInput } from "@/lib/validation/invoice";

/**
 * Genera un código correlativo para facturas / conduces (Ej: FAC-20260807-001 o CND-20260807-001)
 */
async function generateInvoiceNumber(type: "FACTURA" | "CONDUCE"): Promise<string> {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  const prefix = type === "FACTURA" ? `FAC-${dateStr}-` : `CND-${dateStr}-`;

  const countToday = await prisma.invoice.count({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
  });

  const nextNum = (countToday + 1).toString().padStart(3, "0");
  return `${prefix}${nextNum}`;
}

/**
 * Crea una Factura o Conduce de Entrega en el sistema
 */
export async function createInvoiceAction(input: InvoiceInput) {
  try {
    const user = await requirePermission("facturas.emitir");
    const userId = user.id;
    if (!userId) throw new Error("La sesión no tiene un usuario identificable.");
    const validated = invoiceSchema.parse(input);
    const branchExists = await prisma.branch.findFirst({ where: { name: validated.branch, status: "ACTIVE" }, select: { id: true } });
    if (!branchExists) throw new Error("La sucursal seleccionada no existe o está inactiva.");

    const invoiceNumber = validated.invoiceNumber || (await generateInvoiceNumber(validated.type));

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          ncf: validated.ncf?.trim() || null,
          type: validated.type,
          clientName: validated.clientName.trim(),
          clientTaxId: validated.clientTaxId?.trim() || null,
          clientPhone: validated.clientPhone?.trim() || null,
          clientAddress: validated.clientAddress?.trim() || null,
          branch: validated.branch,
          paymentMethod: validated.paymentMethod || "Efectivo",
          subtotal: Number(validated.subtotal) || 0,
          tax: Number(validated.tax) || 0,
          discount: Number(validated.discount) || 0,
          total: Number(validated.total) || 0,
          notes: validated.notes?.trim() || null,
          status: "EMITIDA",
          createdBy: user.name || user.email || userId,
          items: {
            create: validated.items.map((item) => ({
              description: item.description.trim(),
              sku: item.sku?.trim() || null,
              imeis: item.imeis?.trim() || null,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              tax: Number(item.tax) || 0,
              totalPrice: Number(item.totalPrice) || 0,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return created;
    });

    await logAudit({
      userId,
      action: "CREATE",
      module: "FACTURAS",
      entityType: validated.type,
      entityId: invoice.id,
      afterData: { invoiceNumber, total: invoice.total, itemCount: invoice.items.length },
    });

    revalidatePath("/facturas");
    return {
      success: true,
      data: invoice,
      message: `${validated.type === "FACTURA" ? "Factura" : "Conduce"} ${invoiceNumber} emitida exitosamente`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al emitir el documento" };
  }
}

/**
 * Obtiene el historial de Facturas y Conduces con búsqueda y filtros
 */
export async function getInvoicesAction(query?: string, type?: string) {
  try {
    await requireUser();
    const where: any = {};

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { ncf: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { clientTaxId: { contains: q, mode: "insensitive" } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: invoices };
  } catch (error: any) {
    return { success: false, error: "Error al cargar facturas", data: [] };
  }
}

/**
 * Obtiene una factura por ID con sus ítems
 */
export async function getInvoiceByIdAction(id: string) {
  try {
    await requireUser();
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) return { success: false, error: "Documento no encontrado" };
    return { success: true, data: invoice };
  } catch (error: any) {
    return { success: false, error: "Error al cargar detalle del documento" };
  }
}

/**
 * Elimina o anula un documento
 */
export async function deleteInvoiceAction(id: string) {
  try {
    const user = await requirePermission("facturas.eliminar");
    const userId = user.id;
    if (!userId) throw new Error("La sesión no tiene un usuario identificable.");
    const deleted = await prisma.invoice.delete({
      where: { id },
    });

    await logAudit({
      userId,
      action: "DELETE",
      module: "FACTURAS",
      entityType: deleted.type,
      entityId: deleted.id,
      beforeData: { invoiceNumber: deleted.invoiceNumber, total: deleted.total },
    });

    revalidatePath("/facturas");
    return { success: true, message: "Documento eliminado" };
  } catch (error: any) {
    return { success: false, error: "Error al eliminar el documento" };
  }
}
