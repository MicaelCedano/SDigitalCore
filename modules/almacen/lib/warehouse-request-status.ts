import { prisma } from "@/lib/db/prisma";
import { sendPushToUsers } from "@/lib/mobile/push";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planWarehouseRequestLines, warehouseRequestVersionSnapshot, type StockProduct, type WarehouseRequestView } from "./warehouse-request-plan";
import { applyStockDelta } from "./warehouse-stock";

const inputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  status: z.enum(["APPROVED", "REJECTED"]),
  actorId: z.string().trim().min(1).max(100),
  source: z.enum(["web", "chatgpt", "mcp"]),
});

function toStockProduct(product: {
  id: string;
  code: string;
  name: string;
  color: string | null;
  status: string;
  boxes: number;
  looseUnits: number;
  totalUnits: number;
  unitsPerBox: number;
}): StockProduct {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    color: product.color,
    status: product.status,
    boxes: product.boxes,
    looseUnits: product.looseUnits,
    totalUnits: product.totalUnits,
    unitsPerBox: product.unitsPerBox,
  };
}

export function toWarehouseRequestView(request: {
  id: string;
  requestCode: string;
  title: string;
  branch: string;
  requestedBy: string;
  type: "ENTRY" | "EXIT";
  status: string;
  details: string | null;
  updatedAt: Date;
  items: Array<{ productId: string; unitsCount: number; product: Parameters<typeof toStockProduct>[0] | null }>;
}): WarehouseRequestView {
  return {
    id: request.id,
    requestCode: request.requestCode,
    title: request.title,
    branch: request.branch,
    requestedBy: request.requestedBy,
    type: request.type,
    status: request.status,
    details: request.details,
    updatedAt: request.updatedAt,
    items: request.items.map((item) => ({
      productId: item.productId,
      unitsCount: item.unitsCount,
      product: item.product ? toStockProduct(item.product) : null,
    })),
  };
}

export async function readWarehouseRequestDecision(idOCodigo: string) {
  const key = idOCodigo.trim();
  if (!key) return null;
  const request = await prisma.warehouseRequest.findFirst({
    where: { OR: [{ id: key }, { requestCode: key }, { requestCode: key.toUpperCase() }] },
    include: { items: { include: { product: true } } },
  });
  if (!request) return null;
  const view = toWarehouseRequestView(request);
  return { request: view, snapshot: warehouseRequestVersionSnapshot(view) };
}

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
        afterData: source === "mcp"
          ? { status, source, actor: "mcp/owner", requestCode: request.requestCode }
          : { status, source },
      },
    });
    if (status === "REJECTED") return request;

    const products = await tx.warehouseProduct.findMany({
      where: { id: { in: request.items.map((item) => item.productId) } },
    });
    const plan = planWarehouseRequestLines({
      type: request.type,
      details: request.details,
      statusDecision: "APPROVED",
      items: request.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return {
          productId: item.productId,
          unitsCount: item.unitsCount,
          product: product ? toStockProduct(product) : null,
        };
      }),
    });
    if (plan.errors.length > 0) throw new Error(plan.errors[0]);

    const movements = [];
    for (const line of plan.lines) {
      if (line.measure === null || line.quantity === null || line.movementUnits === null || line.boxesCount === null) {
        throw new Error(line.error || "Uno de los productos de la solicitud ya no existe.");
      }
      await applyStockDelta(
        tx,
        line.productId,
        request.type,
        { measure: line.measure, quantity: line.quantity, unitsCount: line.movementUnits },
        false,
      );
      movements.push({
        productId: line.productId,
        type: request.type,
        boxesCount: line.boxesCount,
        totalUnits: line.movementUnits,
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
