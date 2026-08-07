"use server";

import { extractInvoiceFromPDF } from "./pdf-extraction";

export type ChargerCategory = "USB_LIGHTNING_10W" | "TPC_LIGHTNING_20W" | "TPC_LIGHTNING_33W" | "TPC_TPC_33W";

export interface ChargerClassificationItem {
  quantity: number;
  description: string;
  category: ChargerCategory;
}

export type ChargerClassificationResult =
  | { success: true; data: Record<ChargerCategory, ChargerClassificationItem[]> }
  | { success: false; error: string };

function classify(description: string): ChargerCategory {
  const upper = description.toUpperCase();
  const match = upper.match(/IPHONE\s+(\d+)/);
  if (!match) return "USB_LIGHTNING_10W";

  const model = Number.parseInt(match[1], 10);
  const pro = upper.includes("PRO");
  const mini = upper.includes("MINI");

  if (model >= 15) return "TPC_TPC_33W";
  if (model === 14 || (model === 13 && pro)) return "TPC_LIGHTNING_33W";
  if ((model === 13 && (!pro || mini)) || (model === 12 && pro)) return "TPC_LIGHTNING_20W";
  return "USB_LIGHTNING_10W";
}

export async function classifyChargersFromPDF(formData: FormData): Promise<ChargerClassificationResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { success: false, error: "Selecciona una factura PDF." };
    if (file.type && file.type !== "application/pdf") return { success: false, error: "El archivo debe ser PDF." };
    if (file.size > 10 * 1024 * 1024) return { success: false, error: "El PDF no puede superar 10 MB." };

    const groups: Record<ChargerCategory, ChargerClassificationItem[]> = {
      USB_LIGHTNING_10W: [],
      TPC_LIGHTNING_20W: [],
      TPC_LIGHTNING_33W: [],
      TPC_TPC_33W: [],
    };

    const extraction = await extractInvoiceFromPDF(formData);
    if (!extraction.success) return extraction;

    const iphoneItems = extraction.data.items.filter((item) => /\bIPHONE\b/i.test(item.description));
    for (const item of iphoneItems) {
      const description = item.description.trim();
      const category = classify(description);
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
