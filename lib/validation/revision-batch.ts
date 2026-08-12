import { z } from "zod";

export const revisionBatchDeviceSchema = z.object({
  brand: z.string().optional().nullable().default("Apple"),
  model: z.string().min(1, "El modelo es requerido"),
  storageGb: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().positive().optional().nullable()
  ),
  color: z.string().optional().nullable(),
  imei: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
});

export const createRevisionBatchSchema = z.object({
  supplierName: z.string().min(1, "El nombre del proveedor es obligatorio"),
  supplierId: z.string().optional().nullable(),
  branch: z.string().trim().min(1, "La sucursal es obligatoria"),
  batchNumber: z.string().optional().nullable(), // opcional si se autogenera
  notes: z.string().optional().nullable(),
  devicesText: z.string().optional().nullable(), // para pegar IMEIs masivamente
  defaultModel: z.string().optional().nullable(), // modelo por defecto si se pegan IMEIs simples
  defaultBrand: z.string().optional().nullable().default("Apple"),
  devices: z.array(revisionBatchDeviceSchema).optional().default([]),
});

export const updateRevisionBatchStatusSchema = z.object({
  id: z.string().min(1, "ID del lote requerido"),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "IN_REVIEW", "COMPLETED", "CANCELLED"]),
  notes: z.string().optional().nullable(),
});

export type RevisionBatchDeviceInput = z.infer<typeof revisionBatchDeviceSchema>;
export type CreateRevisionBatchInput = z.infer<typeof createRevisionBatchSchema>;
export type UpdateRevisionBatchStatusInput = z.infer<typeof updateRevisionBatchStatusSchema>;
