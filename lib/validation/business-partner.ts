import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const businessPartnerSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(160),
  kind: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  taxId: optionalText(40),
  contactName: optionalText(160),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.string().trim().email("El correo no es válido.").max(200)]).optional().transform((value) => value || undefined),
  address: optionalText(300),
  notes: optionalText(1000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type BusinessPartnerInput = z.input<typeof businessPartnerSchema>;
