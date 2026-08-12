import { z } from "zod";

/**
 * Solicitud de IMEIs del QC (fórmula SDigitalSystem): el QC manda los IMEIs
 * que quiere revisar y el admin los acepta/rechaza.
 */
export const createImeiRequestSchema = z.object({
  imeis: z
    .array(z.string().trim().min(4, "IMEI inválido").max(20, "IMEI inválido"))
    .min(1, "Ingresa al menos un IMEI")
    .max(200, "Máximo 200 IMEIs por solicitud"),
});

export const resolveImeiRequestSchema = z.object({
  id: z.string().min(1, "ID de solicitud requerido"),
  accept: z.boolean(),
});

export type CreateImeiRequestInput = z.infer<typeof createImeiRequestSchema>;
export type ResolveImeiRequestInput = z.infer<typeof resolveImeiRequestSchema>;
