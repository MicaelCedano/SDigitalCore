import { z } from "zod";

export const stockCountItemSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional().nullable(),
  description: z.string().min(1, "El nombre del producto / modelo es requerido"),
  expectedQty: z.number().int().min(0).default(0),
  countedQty: z.number().int().min(0).default(0),
  difference: z.number().int().default(0),
  scannedImeis: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const stockCountSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "El título del conteo es requerido").default("Conteo Físico de Stock"),
  branch: z.string().min(1, "La sucursal es requerida").default("Principal"),
  performedBy: z.string().optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("IN_PROGRESS"),
  notes: z.string().optional().nullable(),
  items: z.array(stockCountItemSchema).min(1, "Debe agregar al menos un modelo al conteo"),
});

export type StockCountItemInput = z.infer<typeof stockCountItemSchema>;
export type StockCountInput = z.infer<typeof stockCountSchema>;
