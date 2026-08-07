import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "El usuario o correo es requerido"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
