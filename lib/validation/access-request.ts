import { z } from "zod";

export const accessRequestSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre completo es requerido"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .regex(/^[a-zA-Z0-9_.-]+$/, "El usuario solo puede contener letras, números, guiones y puntos"),
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Email inválido"),
  phone: z
    .string()
    .min(7, "El teléfono es requerido"),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
