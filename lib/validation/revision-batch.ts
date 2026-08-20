import { z } from "zod";

export const revisionBatchDeviceSchema = z.object({
  brand: z.string().optional().nullable(),
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
  defaultBrand: z.string().optional().nullable(),
  devices: z.array(revisionBatchDeviceSchema).optional().default([]),
});

export const updateRevisionBatchStatusSchema = z.object({
  id: z.string().min(1, "ID del lote requerido"),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "IN_REVIEW", "COMPLETED", "CANCELLED"]),
  notes: z.string().optional().nullable(),
});

export const updateRevisionBatchBranchSchema = z.object({
  id: z.string().min(1, "ID del lote requerido"),
  branch: z.string().trim().min(1, "La sucursal es obligatoria"),
});

export const assignRevisionBatchSchema = z.object({
  id: z.string().min(1, "ID del lote requerido"),
  assignedToId: z.string().nullable(),
});

export const reviewDeviceSchema = z.object({
  deviceId: z.string().min(1, "El equipo es requerido"),
  result: z.enum(["FUNCTIONAL", "NON_FUNCTIONAL"]),
  grade: z.string().trim().min(1, "El grado estético es obligatorio").max(16),
  notes: z.string().max(1000, "Las observaciones son muy largas").optional().nullable(),
  batteryHealth: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).max(100).optional().nullable()
  ),
});

export type RevisionBatchDeviceInput = z.infer<typeof revisionBatchDeviceSchema>;
export type CreateRevisionBatchInput = z.infer<typeof createRevisionBatchSchema>;
export type UpdateRevisionBatchStatusInput = z.infer<typeof updateRevisionBatchStatusSchema>;
export type UpdateRevisionBatchBranchInput = z.infer<typeof updateRevisionBatchBranchSchema>;
export type ReviewDeviceInput = z.infer<typeof reviewDeviceSchema>;
export type AssignRevisionBatchInput = z.infer<typeof assignRevisionBatchSchema>;
