import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  email: z.string().trim().email("El correo no es válido").max(180),
  username: z.string().trim().min(3, "El usuario debe tener al menos 3 caracteres").max(60),
  phone: z.string().trim().max(30).optional().default(""),
  avatarUrl: z.string().max(2_000_000).optional().default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;
