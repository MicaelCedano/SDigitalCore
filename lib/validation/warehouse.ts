import { z } from "zod";

export const warehouseProductSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "El código del producto es requerido"),
  name: z.string().min(1, "El nombre del producto es requerido"),
  brand: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  boxes: z.number().int().min(0, "Cajas debe ser mayor o igual a 0").default(0),
  unitsPerBox: z.number().int().min(1, "Debe tener al menos 1 unidad por caja").default(1),
  looseUnits: z.number().int().min(0, "Equipos sin caja debe ser mayor o igual a 0").default(0),
});

export const warehouseMovementSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  type: z.enum(["ENTRY", "EXIT"]),
  boxesCount: z.number().int().min(1, "Cantidad de cajas debe ser al menos 1"),
  reason: z.string().min(1, "Ingrese el motivo del movimiento"),
});

export const warehouseRequestSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "El título de la solicitud es requerido"),
  branch: z.string().trim().min(1, "La sucursal es requerida"),
  requestedBy: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  details: z.string().optional().nullable(),
});

export type WarehouseProductInput = z.infer<typeof warehouseProductSchema>;
export type WarehouseMovementInput = z.infer<typeof warehouseMovementSchema>;
export type WarehouseRequestInput = z.infer<typeof warehouseRequestSchema>;
