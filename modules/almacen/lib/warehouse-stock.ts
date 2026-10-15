import type { Prisma } from "@prisma/client";

export function resolveMovementLine(
  item: { unitsCount: number; measure?: "BOXES" | "UNITS"; quantity?: number },
  unitsPerBox: number,
) {
  const measure: "BOXES" | "UNITS" = item.measure === "BOXES" ? "BOXES" : "UNITS";
  const quantity = Math.max(
    1,
    Number(item.quantity) ||
      (measure === "BOXES" ? Math.ceil(item.unitsCount / Math.max(1, unitsPerBox)) : item.unitsCount),
  );
  return {
    measure,
    quantity,
    unitsCount: measure === "BOXES" ? quantity * Math.max(1, unitsPerBox) : quantity,
    boxesCount: measure === "BOXES" ? quantity : 0,
  };
}

export function availableQuantity(
  product: { boxes: number; looseUnits: number; totalUnits: number },
  measure: "BOXES" | "UNITS",
) {
  if (measure === "BOXES") return Math.max(0, product.boxes);
  return product.boxes === 0 ? Math.max(product.looseUnits, product.totalUnits) : Math.max(0, product.looseUnits);
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  productId: string,
  type: "ENTRY" | "EXIT",
  line: { measure: "BOXES" | "UNITS"; quantity: number; unitsCount: number },
  returnProduct = true,
) {
  const direction = type === "ENTRY" ? 1 : -1;
  if (type === "EXIT" && line.measure === "UNITS") {
    const current = await tx.warehouseProduct.findUnique({
      where: { id: productId },
      select: { boxes: true, looseUnits: true, totalUnits: true },
    });
    // Regulariza registros históricos que guardaban unidades solo en totalUnits.
    if (current && current.boxes === 0 && current.looseUnits < current.totalUnits) {
      await tx.warehouseProduct.updateMany({
        where: { id: productId, boxes: 0, looseUnits: current.looseUnits, totalUnits: current.totalUnits },
        data: { looseUnits: current.totalUnits },
      });
    }
  }

  const changed = await tx.warehouseProduct.updateMany({
    where: {
      id: productId,
      status: "ACTIVE",
      ...(type === "EXIT"
        ? line.measure === "BOXES"
          ? { boxes: { gte: line.quantity }, totalUnits: { gte: line.unitsCount } }
          : { looseUnits: { gte: line.quantity }, totalUnits: { gte: line.unitsCount } }
        : {}),
    },
    data: {
      boxes: { increment: line.measure === "BOXES" ? direction * line.quantity : 0 },
      looseUnits: { increment: line.measure === "UNITS" ? direction * line.quantity : 0 },
      totalUnits: { increment: direction * line.unitsCount },
    },
  });
  if (changed.count !== 1) {
    throw new Error("El producto ya no está activo o su stock disponible cambió. Actualiza e intenta de nuevo.");
  }
  if (returnProduct) return tx.warehouseProduct.findUniqueOrThrow({ where: { id: productId } });
}

export function parseRequestLine(details: string | null | undefined, productId: string, unitsCount: number) {
  try {
    const parsed = details ? JSON.parse(details) : null;
    const line = parsed?.items?.[productId];
    if (line?.measure === "BOXES" || line?.measure === "UNITS") {
      return { measure: line.measure as "BOXES" | "UNITS", quantity: Number(line.quantity) || 1 };
    }
  } catch {
    // Solicitudes antiguas guardan texto plano y se interpretan como unidades sueltas.
  }
  return { measure: "UNITS" as const, quantity: unitsCount };
}
