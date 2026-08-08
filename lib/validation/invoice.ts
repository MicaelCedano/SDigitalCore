import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "La descripción del artículo es requerida"),
  sku: z.string().optional().nullable(),
  imeis: z.string().optional().nullable(),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1").default(1),
  unitPrice: z.number().min(0, "El precio unitario no puede ser negativo").default(0),
  tax: z.number().min(0).default(0),
  totalPrice: z.number().min(0).default(0),
});

export const invoiceSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["FACTURA", "CONDUCE"]).default("FACTURA"),
  invoiceNumber: z.string().optional(),
  ncf: z.string().optional().nullable(),
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  clientTaxId: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  branch: z.string().default("Almacén Casita"),
  paymentMethod: z.string().default("Efectivo"),
  subtotal: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "Debe agregar al menos 1 artículo"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
