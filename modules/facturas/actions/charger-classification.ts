"use server";

import { extractInvoiceFromPDF } from "./pdf-extraction";
import { requirePermission } from "@/lib/auth/helpers";
import { classifyCharger, type ChargerCategory } from "../lib/charger-classification";

export interface ChargerClassificationItem {
  quantity: number;
  description: string;
  category: ChargerCategory;
}

export type ChargerClassificationResult =
  | { success: true; data: Record<ChargerCategory, ChargerClassificationItem[]> }
  | { success: false; error: string };

export async function classifyChargersFromPDF(formData: FormData): Promise<ChargerClassificationResult> {
  try {
    await requirePermission("facturas.emitir");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { success: false, error: "Selecciona una factura PDF." };
    if (file.type && file.type !== "application/pdf") return { success: false, error: "El archivo debe ser PDF." };
    if (file.size > 10 * 1024 * 1024) return { success: false, error: "El PDF no puede superar 10 MB." };

    const groups: Record<ChargerCategory, ChargerClassificationItem[]> = {
      TPC_LIGHTNING_20W: [],
      TPC_LIGHTNING_33W: [],
      TPC_TPC_33W: [],
    };

    const extraction = await extractInvoiceFromPDF(formData);
    if (!extraction.success) return extraction;

    const iphoneItems = extraction.data.items.filter((item) => /\bIPHONE\b/i.test(item.description));
    for (const item of iphoneItems) {
      const description = item.description.trim();
      const category = classifyCharger(description);
      groups[category].push({ quantity: item.quantity, description, category });
    }

    if (iphoneItems.length === 0) {
      return { success: false, error: "El PDF se leyó, pero no se encontraron modelos iPhone para clasificar." };
    }

    return { success: true, data: groups };
  } catch (error) {
    console.error("[facturas] Error clasificando cargadores", error);
    return { success: false, error: "No se pudo clasificar la factura PDF." };
  }
}
