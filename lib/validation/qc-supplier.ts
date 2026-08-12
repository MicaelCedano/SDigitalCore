import { z } from "zod";

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

export const qcSupplierSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(160),
  contactName: optionalTrimmedText(160),
  phone: optionalTrimmedText(40),
  email: z.union([z.literal(""), z.string().trim().email("El correo no es válido.").max(200)]).optional()
    .transform((value) => value || undefined),
  notes: optionalTrimmedText(1000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const qcSupplierIdSchema = z.string().cuid();

export type QcSupplierInput = z.input<typeof qcSupplierSchema>;
