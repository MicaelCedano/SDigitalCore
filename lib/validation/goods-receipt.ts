import { z } from "zod";

export const colorVariantSchema = z.object({
  id: z.string().optional(),
  color: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? "General" : val),
    z.string().optional().nullable().default("General")
  ),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1").default(1),
  unitPrice: z.number().min(0).optional().nullable(),
  imeis: z.string().optional().nullable(),
});

export const goodsReceiptItemSchema = z.object({
  code: z.string().optional().nullable(),
  description: z.string().min(1, "La descripción del producto es requerida"),
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
