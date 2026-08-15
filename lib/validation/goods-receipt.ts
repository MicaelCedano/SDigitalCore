import { z } from "zod";

export const colorVariantSchema = z.object({
  id: z.string().optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  color: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().trim().optional().nullable()
  ),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1").default(1),
  unitPrice: z.number().min(0).optional().nullable(),
  imeis: z.string().optional().nullable(),
});

export const goodsReceiptItemSchema = z.object({
  code: z.string().optional().nullable(),
  // Legacy receipts used this field as the product identity. New receipts keep
  // it for observations/compatibility and persist identity in colorVariants.
  description: z.string().optional().nullable().default(""),
  model: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1"),
  unitPrice: z.number().min(0).optional().nullable(),
  condition: z.string().optional().nullable().default("Nuevo"),
  imeiOrSerial: z.string().optional().nullable(),
  colorVariants: z.array(colorVariantSchema).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const goodsReceiptSchema = z.object({
  id: z.string().optional(),
  supplierName: z.string().min(1, "El proveedor es requerido"),
  branch: z.string().trim().min(1, "La sucursal es requerida"),
  receivedBy: z.string().optional(),
  status: z.enum(["DRAFT", "COMPLETED", "CANCELLED"]).default("COMPLETED"),
  notes: z.string().optional().nullable(),
  items: z.array(goodsReceiptItemSchema).min(1, "Debe agregar al menos un ítem al recibo"),
});

export type ColorVariantInput = z.infer<typeof colorVariantSchema>;
export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;

export const goodsReceiptWarehouseImportLineSchema = z.object({
  itemId: z.string().min(1),
  code: z.string().trim().min(1, "El código Kaptas es requerido"),
  name: z.string().trim().min(1, "El modelo es requerido"),
  brand: z.string().trim().optional().default(""),
  capacity: z.string().trim().optional().default(""),
  color: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(1, "La cantidad debe venir del recibo"),
  unitsPerBox: z.number().int().min(1, "Indica cuántas unidades trae una caja"),
});

export const goodsReceiptWarehouseImportSchema = z.object({
  receiptId: z.string().min(1),
  lines: z.array(goodsReceiptWarehouseImportLineSchema).min(1),
});

export type GoodsReceiptWarehouseImportInput = z.infer<typeof goodsReceiptWarehouseImportSchema>;

