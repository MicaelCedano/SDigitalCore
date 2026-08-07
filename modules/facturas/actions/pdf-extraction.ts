"use server";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse/lib/pdf-parse.js");

export interface ExtractedInvoiceItem {
  quantity: number;
  description: string;
}

export interface ExtractedInvoiceData {
  clientName: string;
  invoiceReference: string;
  items: ExtractedInvoiceItem[];
}

export type ExtractionResult =
  | { success: true; data: ExtractedInvoiceData }
  | { success: false; error: string };

const BLACKLIST = [
  "NO FACTURA",
  "CONDICIONES",
  "VENDEDOR",
  "CLIENTE",
  "FECHA",
  "SUBTOTAL",
  "DESCUENTO",
  "ITBIS",
  "TOTAL",
  "PAGINA",
  "RECIBIDO POR",
  "REALIZADO POR",
];

const COLORS = [
  "negro", "rojo", "verde", "azul", "blanco", "gris", "plateado", "dorado",
  "púrpura", "purpura", "morado", "lavanda", "rosa", "rosado", "amarillo",
  "naranja", "marrón", "cyan", "magenta", "grafito", "sierra", "black", "red",
  "green", "blue", "white", "gray", "grey", "silver", "gold", "purple", "pink",
  "yellow", "orange", "brown", "graphite", "midnight blue", "titanium", "oro",
  "arena", "navy", "violet", "mint", "menta", "cream", "beige", "charcoal",
  "turquoise", "turquesa", "oceano", "ocean", "celeste", "platino", "platinum",
  "lavender", "coral", "blaze", "pure", "tendril", "polar", "deep", "space",
  "rose", "veil", "ink", "desert", "awesome", "light", "ligth", "dark",
  "celestial", "ocaso",
];

function cleanModelName(value: string): string {
  let model = value
    .replace(/\s*5g\b/gi, "")
    .replace(/\bSM-[A-Z0-9\/]+\b/gi, "")
    .replace(new RegExp(`\\b(${COLORS.join("|")})\\b`, "gi"), "")
    .replace(/\bPB\d+[A-Z0-9]*\b/gi, "")
    .replace(/\b(KM4K?|MK4K?)\b/gi, "")
    .replace(/\b(VEIL|INK|DESERT)\b/gi, "")
    .replace(/[()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return model || value.trim();
}

function isSerialLine(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    /IMEI|SERIE|SERIAL|\bS\/N\b|\bN\/S\b|\bSN\b/.test(upper) ||
    /\d{14,16}/.test(value.replace(/[-\s]/g, ""))
  );
}

function isSpecificationLine(value: string): boolean {
  return /^\d+\s*(?:\+\s*\d+|MAH|AMH|GB|RAM|ROM|TB|W\b)/i.test(value);
}

function extractClient(text: string): string {
  const match = text.match(/Cliente:\s*([\s\S]*?)(?=\s*(?:Dirección:|Vendedor:|$))/i);
  if (match?.[1]?.trim()) return match[1].replace(/\n/g, " ").trim();

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => /cliente:/i.test(line));
  return index > 0 ? lines[index - 1] : "";
}

function extractInvoiceReference(text: string): string {
  let reference = text.match(/No Factura\s*([A-Za-z0-9\-.]+)/i)?.[1]?.trim() ?? "";
  const invalid = new Set(["CONDICIONES", "DE", "CONTADO", "CREDITO", "FECHA", "VENDEDOR"]);
  if (reference.length > 20 || invalid.has(reference.toUpperCase())) reference = "";

  if (!reference) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const index = lines.findIndex((line) => /no factura/i.test(line));
    for (let offset = 1; index > 0 && offset <= 2; offset += 1) {
      const previous = lines[index - offset];
      if (previous && /^(?:\d+|[A-Z0-9-]+)$/i.test(previous) && previous.length < 12 && !previous.includes("/")) {
        reference = previous;
        break;
      }
    }
  }

  return reference;
}

function extractItems(text: string): ExtractedInvoiceItem[] {
  const items: ExtractedInvoiceItem[] = [];
  const lines = text.split("\n");
  let pendingQuantity: number | null = null;
  let lastItemIndex: number | null = null;

  const isBlacklisted = (line: string) => BLACKLIST.some((entry) => line.toUpperCase().includes(entry));

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const quantityMatch = line.match(/^(\d+(?:[.,]\d{1,2})?)\s*(.*)/);
    if (quantityMatch && !isSpecificationLine(line)) {
      const quantity = Number.parseFloat(quantityMatch[1].replace(",", "."));
      const rest = quantityMatch[2].trim();
      if (!quantity || quantity > 9000 || rest.startsWith("/") || rest.startsWith("-")) continue;

      if (!rest) {
        pendingQuantity = quantity;
        lastItemIndex = null;
        continue;
      }
      if (/^[\d.,]+$/.test(rest) || isSerialLine(rest)) continue;

      const description = cleanModelName(rest.replace(/\d{1,3}(?:,\d{3})*\.\d{2}.*/, ""));
      if (description && !isBlacklisted(description)) {
        items.push({ quantity: Math.round(quantity), description });
        lastItemIndex = items.length - 1;
        pendingQuantity = null;
      }
      continue;
    }

    if (pendingQuantity !== null) {
      const description = cleanModelName(line);
      if (description.length >= 3 && !isBlacklisted(description) && !isSerialLine(description)) {
        items.push({ quantity: Math.round(pendingQuantity), description });
      }
      pendingQuantity = null;
      lastItemIndex = items.length ? items.length - 1 : null;
      continue;
    }

    if (lastItemIndex !== null && line.length > 1 && !isBlacklisted(line) && !isSerialLine(line) && !/^[\d.,]+$/.test(line)) {
      items[lastItemIndex].description = cleanModelName(`${items[lastItemIndex].description} ${line}`);
    }
  }

  return items.reduce<ExtractedInvoiceItem[]>((grouped, item) => {
    const existing = grouped.find((candidate) => candidate.description === item.description);
    if (existing) existing.quantity += item.quantity;
    else grouped.push({ ...item });
    return grouped;
  }, []);
}

export async function extractInvoiceFromPDF(formData: FormData): Promise<ExtractionResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { success: false, error: "Selecciona un PDF válido." };
    if (file.type && file.type !== "application/pdf") return { success: false, error: "El archivo debe ser PDF." };
    if (file.size > 10 * 1024 * 1024) return { success: false, error: "El PDF no puede superar 10 MB." };

    const parser = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
    const parsed = await parser(Buffer.from(await file.arrayBuffer()));
    const text = String(parsed.text ?? "");

    return {
      success: true,
      data: {
        clientName: extractClient(text),
        invoiceReference: extractInvoiceReference(text),
        items: extractItems(text),
      },
    };
  } catch (error) {
    console.error("[facturas] Error extrayendo PDF", error);
    return { success: false, error: "No se pudo leer el PDF. Puedes completar los datos manualmente." };
  }
}
