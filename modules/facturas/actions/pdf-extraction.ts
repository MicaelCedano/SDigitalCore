"use server";

import { createRequire } from "node:module";
import { requirePermission } from "@/lib/auth/helpers";
import { parseInvoiceText, type ExtractedInvoiceData } from "./pdf-text-parser";

const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse/lib/pdf-parse.js");

export type ExtractionResult =
  | { success: true; data: ExtractedInvoiceData }
  | { success: false; error: string };

export async function extractInvoiceFromPDF(formData: FormData): Promise<ExtractionResult> {
  try {
    await requirePermission("facturas.emitir");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { success: false, error: "Selecciona un PDF válido." };
    if (file.type && file.type !== "application/pdf") return { success: false, error: "El archivo debe ser PDF." };
    if (file.size > 10 * 1024 * 1024) return { success: false, error: "El PDF no puede superar 10 MB." };

    const parser = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
    const parsed = await parser(Buffer.from(await file.arrayBuffer()));
    const text = String(parsed.text ?? "");

    return {
      success: true,
      data: parseInvoiceText(text),
    };
  } catch (error) {
    console.error("[facturas] Error extrayendo PDF", error);
    return { success: false, error: "No se pudo leer el PDF. Puedes completar los datos manualmente." };
  }
}
