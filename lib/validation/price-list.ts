import { z } from "zod";

export const priceListItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional().nullable(),
  model: z.string().min(1, "El modelo / nombre es requerido"),
  category: z.string().default("Celulares"),
  brand: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  costPrice: z.number().min(0).default(0),
  wholesalePrice: z.number().min(0).default(0),
  retailPrice: z.number().min(0).default(0),
  minPrice: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  isActive: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type PriceListItemInput = z.infer<typeof priceListItemSchema>;

export const priceListBrandSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la marca es requerido").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color no es válido").default("#111827"),
});

export const priceListOrderSchema = z.object({
  itemIds: z.array(z.string().min(1)).max(1000),
});

export const priceListBrandOrderSchema = z.object({
  brandIds: z.array(z.string().min(1)).max(200),
});

export type PriceListBrandInput = z.infer<typeof priceListBrandSchema>;
