import { z } from "zod";

export const warehouseProductSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "El cÃ³digo del producto es requerido"),
  name: z.string().min(1, "El nombre del producto es requerido"),
  brand: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  boxes: z.number().int().min(0, "Cajas debe ser mayor o igual a 0").default(0),
  unitsPerBox: z.number().int().min(0, "Unidades por caja debe ser mayor o igual a 0").default(1),
  looseUnits: z.number().int().min(0, "Equipos sin caja debe ser mayor o igual a 0").default(0),
}).refine(
  (data) => data.boxes === 0 || data.unitsPerBox >= 1,
  "Indica al menos 1 unidad por caja cuando registres cajas."
);

export const warehouseMovementSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  type: z.enum(["ENTRY", "EXIT"]),
  unitsCount: z.number().int().min(1, "Cantidad de unidades debe ser al menos 1"),
  reason: z.string().min(1, "Ingrese el motivo del movimiento"),
});

export const warehouseMovementItemSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  unitsCount: z.number().int().min(1, "Cantidad de unidades debe ser al menos 1"),
});

export const warehouseBulkMovementSchema = z.object({
  type: z.enum(["ENTRY", "EXIT"]),
  reason: z.string().trim().min(1, "Ingrese el motivo del movimiento"),
  items: z.array(warehouseMovementItemSchema).min(1, "Debe agregar al menos un producto"),
});

export const warehouseRequestSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "El tÃ­tulo de la solicitud es requerido"),
  branch: z.string().trim().min(1, "La sucursal es requerida"),
  requestedBy: z.string().optional(),
  type: z.enum(["ENTRY", "EXIT"]).default("EXIT"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  details: z.string().optional().nullable(),
  items: z.array(warehouseMovementItemSchema).min(1, "Debe agregar al menos un producto"),
});

export type WarehouseProductInput = z.infer<typeof warehouseProductSchema>;
export type WarehouseMovementInput = z.infer<typeof warehouseMovementSchema>;
export type WarehouseBulkMovementInput = z.infer<typeof warehouseBulkMovementSchema>;
export type WarehouseRequestInput = z.infer<typeof warehouseRequestSchema>;

