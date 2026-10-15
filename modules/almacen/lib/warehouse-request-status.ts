import { prisma } from "@/lib/db/prisma";
import { sendPushToUsers } from "@/lib/mobile/push";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { applyStockDelta, availableQuantity, parseRequestLine, resolveMovementLine } from "./warehouse-stock";

const inputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  status: z.enum(["APPROVED", "REJECTED"]),
  actorId: z.string().trim().min(1).max(100),
  source: z.enum(["web", "chatgpt"]),
});

export async function updateWarehouseRequestStatus(input: z.input<typeof inputSchema>) {
  const { id, status, actorId, source } = inputSchema.parse(input);
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.warehouseRequest.updateMany({ where: { id, status: "PENDING" }, data: { status } });
    if (claimed.count !== 1) throw new Error("La solicitud no existe o ya fue procesada. Actualiza la lista.");

    const request = await tx.warehouseRequest.findUnique({ where: { id }, include: { items: true } });
    if (!request) throw new Error("Solicitud no encontrada.");

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "warehouse_request.status.update",
        module: "almacen",
        entityType: "warehouse_request",
        entityId: id,
        beforeData: { status: "PENDING" },
        afterData: { status, source },
      },
    });
    if (status === "REJECTED") return request;

    const movements: Prisma.WarehouseMovementCreateManyInput[] = [];
    const products = await tx.warehouseProduct.findMany({
      where: { id: { in: request.items.map((item) => item.productId) }, status: "ACTIVE" },
    });
    for (const item of [...request.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) throw new Error("Uno de los productos de la solicitud ya no existe.");

      const savedLine = parseRequestLine(request.details, item.productId, item.unitsCount);
      const line = resolveMovementLine({ unitsCount: item.unitsCount, ...savedLine }, product.unitsPerBox);
      if (
        request.type === "EXIT" &&
        (availableQuantity(product, line.measure) < line.quantity || product.totalUnits < line.unitsCount)
      ) {
        throw new Error(
          `Stock insuficiente para ${product.code} · ${product.name} ${product.color || ""}: solicita ${line.quantity} ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"}; disponibles ${availableQuantity(product, line.measure)}.`,
        );
      }

      await applyStockDelta(tx, product.id, request.type, line, false);
      movements.push({
        productId: product.id,
        type: request.type,
        boxesCount: line.boxesCount,
        totalUnits: line.unitsCount,
        reason: `Solicitud ${request.requestCode}: ${request.title}`,
        createdBy: actorId,
      });
    }
    await tx.warehouseMovement.createMany({ data: movements });
    return request;
  }, { maxWait: 10_000, timeout: 30_000 });

  try {
    const requesterIdentity = await prisma.warehouseRequest.findUnique({ where: { id }, select: { requestedBy: true } });
    const requesterMatches = requesterIdentity?.requestedBy
      ? await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              { id: requesterIdentity.requestedBy },
              { email: requesterIdentity.requestedBy },
              { username: requesterIdentity.requestedBy },
              { name: requesterIdentity.requestedBy },
            ],
          },
          select: { id: true },
          take: 2,
        })
      : [];
    const requester = requesterMatches.length === 1 ? requesterMatches[0] : null;
    if (requester) {
      await sendPushToUsers([requester.id], {
        title: status === "APPROVED" ? "Solicitud de almacén aprobada" : "Solicitud de almacén rechazada",
        body: `La solicitud ${updated.requestCode} fue ${status === "APPROVED" ? "aprobada" : "rechazada"}.`,
        route: "/almacen/transferencias",
        type: status === "APPROVED" ? "warehouse_request.approved" : "warehouse_request.rejected",
      });
    }
  } catch (notificationError) {
    console.error("Solicitud procesada; no se pudo notificar al solicitante", notificationError);
  }

  revalidatePath("/almacen");
  revalidatePath("/almacen/movimientos");
  revalidatePath("/almacen/transferencias");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return updated;
}
