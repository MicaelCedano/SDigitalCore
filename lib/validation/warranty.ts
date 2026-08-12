import { z } from "zod";

export const imeiSchema = z.string().trim().regex(/^\d{15}$/, "El IMEI debe tener exactamente 15 dígitos.");
const text = (label: string, max = 180) => z.string().trim().min(1, `${label} es obligatorio.`).max(max, `${label} es demasiado largo.`);
const optionalText = (max: number) => z.string().trim().max(max).optional();

function isValidCivilDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayInSantoDomingo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const warrantyDeviceSchema = z.object({
  imei: imeiSchema,
  model: text("El modelo", 120),
  color: optionalText(80),
  problem: text("El problema", 1000),
});

export const createWarrantySchema = z.object({
  clientName: text("El cliente", 160),
  entryDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
    .refine(isValidCivilDate, "La fecha no existe.")
    .refine((value) => value <= todayInSantoDomingo(), "La fecha de ingreso no puede estar en el futuro."),
  devices: z.array(warrantyDeviceSchema).min(1).max(100),
}).superRefine((input, ctx) => {
  const seen = new Set<string>();
  input.devices.forEach((device, index) => {
    if (seen.has(device.imei)) ctx.addIssue({ code: "custom", path: ["devices", index, "imei"], message: "El IMEI está repetido en este lote." });
    seen.add(device.imei);
  });
});

export const caseCodesSchema = z.object({ caseCodes: z.array(text("Código", 40)).min(1).max(100) }).superRefine((input, ctx) => {
  if (new Set(input.caseCodes).size !== input.caseCodes.length) ctx.addIssue({ code: "custom", path: ["caseCodes"], message: "Hay casos repetidos." });
});

export const updateWarrantySchema = z.object({ caseCode: text("El código", 40), clientName: text("El cliente", 160), model: text("El modelo", 120), imei: imeiSchema, problem: text("El problema", 1000) });
export const flowSchema = caseCodesSchema.extend({ counterpartyName: optionalText(160), reason: optionalText(1000), technicianId: z.string().optional() });
export const archiveWarrantySchema = z.object({ caseCode: text("El código", 40), reason: text("El motivo", 1000) });
export const restoreWarrantySchema = z.object({ caseCode: text("El código", 40), reason: optionalText(1000) });

export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>;
