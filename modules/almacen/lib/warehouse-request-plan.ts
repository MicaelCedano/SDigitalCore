import { availableQuantity, parseRequestLine, resolveMovementLine } from "./warehouse-stock";

export type StockMeasure = "BOXES" | "UNITS";

export type StockProduct = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  status: string;
  boxes: number;
  looseUnits: number;
  totalUnits: number;
  unitsPerBox: number;
};

export type WarehouseRequestItemView = {
  productId: string;
  unitsCount: number;
  product: StockProduct | null;
};

export type WarehouseRequestView = {
  id: string;
  requestCode: string;
  title: string;
  branch: string;
  requestedBy: string;
  type: "ENTRY" | "EXIT";
  status: string;
  details: string | null;
  updatedAt: Date | string;
  items: WarehouseRequestItemView[];
};

type ResolvedLine = {
  productId: string;
  unitsCount: number;
  product: StockProduct | null;
  measure: StockMeasure | null;
  quantity: number | null;
  movementUnits: number | null;
  boxesCount: number | null;
};

export type PlannedLine = {
  productId: string;
  code: string | null;
  name: string | null;
  color: string | null;
  productStatus: string | null;
  measure: StockMeasure | null;
  quantity: number | null;
  unitsCount: number;
  movementUnits: number | null;
  boxesCount: number | null;
  unitsPerBox: number | null;
  stockActual: { cajas: number; sueltas: number; total: number; disponible: number } | null;
  stockResultante: { cajas: number; sueltas: number; total: number } | null;
  error: string | null;
};

export function movementForRequestItem(
  details: string | null | undefined,
  item: { productId: string; unitsCount: number },
  unitsPerBox: number,
) {
  const savedLine = parseRequestLine(details, item.productId, item.unitsCount);
  return resolveMovementLine({ unitsCount: item.unitsCount, ...savedLine }, unitsPerBox);
}

export function exitStockInsufficient(
  product: { boxes: number; looseUnits: number; totalUnits: number },
  line: { measure: StockMeasure; quantity: number; unitsCount: number },
) {
  return availableQuantity(product, line.measure) < line.quantity || product.totalUnits < line.unitsCount;
}

export function insufficientStockMessage(
  product: { code: string; name: string; color: string | null; boxes: number; looseUnits: number; totalUnits: number },
  line: { measure: StockMeasure; quantity: number },
) {
  const disponible = availableQuantity(product, line.measure);
  return `Stock insuficiente para ${product.code} · ${product.name} ${product.color || ""}: solicita ${line.quantity} ${line.measure === "BOXES" ? "cajas" : "unidades sueltas"}; disponibles ${disponible}.`;
}

export function projectStockAfterMovement(
  product: { boxes: number; looseUnits: number; totalUnits: number },
  type: "ENTRY" | "EXIT",
  line: { measure: StockMeasure; quantity: number; unitsCount: number },
) {
  let looseUnits = product.looseUnits;
  if (type === "EXIT" && line.measure === "UNITS" && product.boxes === 0 && looseUnits < product.totalUnits) {
    looseUnits = product.totalUnits;
  }
  const direction = type === "ENTRY" ? 1 : -1;
  return {
    boxes: product.boxes + (line.measure === "BOXES" ? direction * line.quantity : 0),
    looseUnits: looseUnits + (line.measure === "UNITS" ? direction * line.quantity : 0),
    totalUnits: product.totalUnits + direction * line.unitsCount,
  };
}

export function resolveWarehouseRequestLines(request: Pick<WarehouseRequestView, "details" | "items">): ResolvedLine[] {
  return [...request.items]
    .sort((left, right) => left.productId.localeCompare(right.productId))
    .map((item) => {
      if (!item.product) {
        return {
          productId: item.productId,
          unitsCount: item.unitsCount,
          product: null,
          measure: null,
          quantity: null,
          movementUnits: null,
          boxesCount: null,
        };
      }
      const line = movementForRequestItem(request.details, item, item.product.unitsPerBox);
      return {
        productId: item.productId,
        unitsCount: item.unitsCount,
        product: item.product,
        measure: line.measure,
        quantity: line.quantity,
        movementUnits: line.unitsCount,
        boxesCount: line.boxesCount,
      };
    });
}

export function planWarehouseRequestLines(input: {
  type: "ENTRY" | "EXIT";
  details: string | null;
  statusDecision: "APPROVED" | "REJECTED";
  items: WarehouseRequestItemView[];
}): { lines: PlannedLine[]; errors: string[] } {
  const errors: string[] = [];
  const lines: PlannedLine[] = [];
  for (const resolved of resolveWarehouseRequestLines(input)) {
    const product = resolved.product;
    const measure = resolved.measure;
    const quantity = resolved.quantity;
    const movementUnits = resolved.movementUnits;
    const boxesCount = resolved.boxesCount;
    let error: string | null = null;
    if (!product || measure === null || quantity === null || movementUnits === null || boxesCount === null) {
      error = "Uno de los productos de la solicitud ya no existe.";
    } else if (input.statusDecision === "APPROVED" && product.status !== "ACTIVE") {
      error = "Uno de los productos de la solicitud ya no existe.";
    } else if (input.statusDecision === "APPROVED" && input.type === "EXIT" && exitStockInsufficient(product, { measure, quantity, unitsCount: movementUnits })) {
      error = insufficientStockMessage(product, { measure, quantity });
    }
    if (input.statusDecision === "REJECTED") error = null;
    if (error) errors.push(error);

    const stockActual = product
      ? {
          cajas: product.boxes,
          sueltas: product.looseUnits,
          total: product.totalUnits,
          disponible: measure ? availableQuantity(product, measure) : Math.max(0, product.totalUnits),
        }
      : null;
    let stockResultante = stockActual
      ? { cajas: stockActual.cajas, sueltas: stockActual.sueltas, total: stockActual.total }
      : null;
    if (product && measure && quantity !== null && movementUnits !== null && input.statusDecision === "APPROVED") {
      const projected = projectStockAfterMovement(product, input.type, { measure, quantity, unitsCount: movementUnits });
      stockResultante = { cajas: projected.boxes, sueltas: projected.looseUnits, total: projected.totalUnits };
    }

    lines.push({
      productId: resolved.productId,
      code: product?.code ?? null,
      name: product?.name ?? null,
      color: product?.color ?? null,
      productStatus: product?.status ?? null,
      measure: resolved.measure,
      quantity: resolved.quantity,
      unitsCount: resolved.unitsCount,
      movementUnits: resolved.movementUnits,
      boxesCount: resolved.boxesCount,
      unitsPerBox: product?.unitsPerBox ?? null,
      stockActual,
      stockResultante,
      error,
    });
  }
  return { lines, errors };
}

function isoStamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function warehouseRequestVersionSnapshot(request: WarehouseRequestView): Record<string, unknown> {
  return {
    id: request.id,
    codigo: request.requestCode,
    titulo: request.title,
    sucursal: request.branch,
    solicitadoPor: request.requestedBy,
    tipo: request.type,
    estado: request.status,
    actualizado: isoStamp(request.updatedAt),
    items: resolveWarehouseRequestLines(request).map((line) => ({
      productId: line.productId,
      unidades: line.unitsCount,
      medida: line.measure,
      cantidad: line.quantity,
      unidadesMovimiento: line.movementUnits,
      estadoProducto: line.product?.status ?? null,
      unidadesPorCaja: line.product?.unitsPerBox ?? null,
      cajas: line.product?.boxes ?? null,
      sueltas: line.product?.looseUnits ?? null,
      total: line.product?.totalUnits ?? null,
    })),
  };
}

function previewLineError(line: PlannedLine): string | null {
  if (!line.error) return null;
  if (line.productStatus && line.productStatus !== "ACTIVE") {
    return `El producto ${line.code} · ${line.name} no está activo.`;
  }
  return line.error;
}

export function buildWarehouseDecisionPreview(request: WarehouseRequestView, decision: "APPROVED" | "REJECTED") {
  const snapshot = warehouseRequestVersionSnapshot(request);
  const plan = planWarehouseRequestLines({
    type: request.type,
    details: request.details,
    statusDecision: decision,
    items: request.items,
  });
  const errores: string[] = [];
  if (request.status !== "PENDING") {
    errores.push(`La solicitud no está pendiente (${request.status}). Solo se decide una solicitud PENDING.`);
  } else {
    errores.push(...plan.lines.flatMap((line) => {
      const message = previewLineError(line);
      return message ? [message] : [];
    }));
  }
  const advertencias: string[] = [];
  if (request.status === "PENDING" && decision === "REJECTED") {
    advertencias.push("El rechazo no mueve inventario.");
  }
  if (request.status === "PENDING" && decision === "APPROVED" && errores.length === 0 && request.type === "EXIT") {
    advertencias.push("La salida descuenta existencias. Al confirmar se vuelve a validar el stock dentro de una transacción.");
  }
  if (request.status === "PENDING" && decision === "APPROVED" && errores.length === 0 && request.type === "ENTRY") {
    advertencias.push("La entrada suma existencias. Al confirmar se vuelve a comprobar que los productos sigan activos.");
  }
  const vista = {
    solicitud: {
      id: request.id,
      codigo: request.requestCode,
      titulo: request.title,
      sucursal: request.branch,
      solicitado_por: request.requestedBy,
      tipo: request.type,
      estado: request.status,
    },
    decision,
    items: plan.lines.map((line) => ({
      producto_id: line.productId,
      codigo: line.code,
      nombre: line.name,
      color: line.color,
      estado_producto: line.productStatus,
      medida: line.measure,
      cantidad: line.quantity,
      unidades: line.movementUnits ?? line.unitsCount,
      stock_actual: line.stockActual,
      stock_resultante: line.stockResultante,
      error: request.status === "PENDING" ? previewLineError(line) : null,
      detalle: request.status === "PENDING" && line.productStatus && line.productStatus !== "ACTIVE"
        ? `El producto ${line.code} · ${line.name} no está activo.`
        : null,
    })),
    errores,
    advertencias,
  };
  return {
    ok: errores.length === 0,
    errores,
    advertencias,
    cambios: { estado: decision } as Record<string, unknown>,
    snapshot,
    vista,
  };
}
