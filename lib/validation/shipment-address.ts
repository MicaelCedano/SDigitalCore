import { z } from "zod";

export const shipmentAddressSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(160),
  address: z.string().trim().min(3, "La dirección es requerida.").max(400),
  mapsUrl: z.string().trim().url("El enlace de Google Maps no es válido.").max(1000).optional().or(z.literal("")),
  isDefaultOrigin: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type ShipmentAddressInput = z.infer<typeof shipmentAddressSchema>;
