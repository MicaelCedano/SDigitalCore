import { z } from "zod";

export const branchSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "El nombre de la sucursal es requerido"),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type BranchInput = z.infer<typeof branchSchema>;
