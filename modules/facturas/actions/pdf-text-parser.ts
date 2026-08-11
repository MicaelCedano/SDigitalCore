export interface ExtractedInvoiceItem {
  quantity: number;
  description: string;
  imeis: string;
}

export interface ExtractedInvoiceData {
  clientName: string;
  invoiceReference: string;
  items: ExtractedInvoiceItem[];
}

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
  "VIGENCIA DE PAGO",
  "FORMA DE PAGO",
  "TERMINOS DE PAGO",
  "TÉRMINOS DE PAGO",
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

const IMEI_PATTERN = /(?<!\d)\d(?:[\s-]?\d){14}(?!\d)/g;
const AMAZON_SERIAL_PATTERN = /(?<![A-Z0-9])YTAMZ\d{4}(?![A-Z0-9])/gi;

function cleanModelName(value: string): string {
  const model = value
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

function extractIdentifiers(value: string): string[] {
  const imeis = (value.match(IMEI_PATTERN) ?? [])
    .map((candidate) => candidate.replace(/\D/g, ""))
    .filter((candidate) => candidate.length === 15);
  const serials = (value.match(AMAZON_SERIAL_PATTERN) ?? []).map((candidate) => candidate.toUpperCase());

  return Array.from(new Set([...imeis, ...serials]));
}

function stripIdentifiers(value: string): string {
  return value
    .replace(IMEI_PATTERN, " ")
    .replace(AMAZON_SERIAL_PATTERN, " ")
    .replace(/\b(?:IMEI(?:\s*[12])?|SERIE|SERIAL|S\s*\/\s*N|N\s*\/\s*S|SN)\b\s*[:#-]?/gi, " ")
    .replace(/^[\s:;,|/-]+|[\s:;,|/-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isSerialLine(value: string): boolean {
  const upper = value.toUpperCase();
  return /IMEI|SERIE|SERIAL|\bS\/N\b|\bN\/S\b|\bSN\b/.test(upper);
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
  const items: Array<ExtractedInvoiceItem & { imeiList: string[] }> = [];
  const lines = text.split("\n");
  let pendingQuantity: number | null = null;
  let lastItemIndex: number | null = null;
  let pendingImeis: string[] = [];

  const isBlacklisted = (line: string) => BLACKLIST.some((entry) => line.toUpperCase().includes(entry));
  const addImeis = (itemIndex: number, imeis: string[]) => {
    items[itemIndex].imeiList = Array.from(new Set([...items[itemIndex].imeiList, ...imeis]));
  };
  const pushItem = (quantity: number, description: string, imeis: string[]) => {
    items.push({ quantity, description, imeis: "", imeiList: Array.from(new Set([...pendingImeis, ...imeis])) });
    lastItemIndex = items.length - 1;
    pendingImeis = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const lineImeis = extractIdentifiers(line);
    const content = stripIdentifiers(line);

    if (!content && lineImeis.length > 0) {
      if (lastItemIndex === null) pendingImeis = Array.from(new Set([...pendingImeis, ...lineImeis]));
      else addImeis(lastItemIndex, lineImeis);
      continue;
    }

    const quantityMatch = content.match(/^(\d+(?:[.,]\d{1,2})?)\s*(.*)/);
    if (quantityMatch && !isSpecificationLine(content)) {
      const quantity = Number.parseFloat(quantityMatch[1].replace(",", "."));
      const rest = quantityMatch[2].trim();
      if (!quantity || quantity > 9000 || rest.startsWith("/") || rest.startsWith("-")) continue;

      if (!rest) {
        pendingQuantity = quantity;
        lastItemIndex = null;
        pendingImeis = Array.from(new Set([...pendingImeis, ...lineImeis]));
        continue;
      }
      if (/^[\d.,]+$/.test(rest) || isSerialLine(rest)) {
        if (lastItemIndex === null) pendingImeis = Array.from(new Set([...pendingImeis, ...lineImeis]));
        else addImeis(lastItemIndex, lineImeis);
        continue;
      }

      const description = cleanModelName(rest.replace(/\d{1,3}(?:,\d{3})*\.\d{2}.*/, ""));
      if (description && !isBlacklisted(description)) {
        pushItem(Math.round(quantity), description, lineImeis);
        pendingQuantity = null;
      }
      continue;
    }

    if (pendingQuantity !== null) {
      const description = cleanModelName(content);
      if (description.length >= 3 && !isBlacklisted(description) && !isSerialLine(description)) {
        pushItem(Math.round(pendingQuantity), description, lineImeis);
      }
      pendingQuantity = null;
      continue;
    }

    if (lineImeis.length > 0) {
      if (lastItemIndex === null) pendingImeis = Array.from(new Set([...pendingImeis, ...lineImeis]));
      else addImeis(lastItemIndex, lineImeis);
      continue;
    }

    if (lastItemIndex !== null && content.length > 1 && !isBlacklisted(content) && !isSerialLine(content) && !/^[\d.,]+$/.test(content)) {
      items[lastItemIndex].description = cleanModelName(`${items[lastItemIndex].description} ${content}`);
    }
  }

  return items.reduce<ExtractedInvoiceItem[]>((grouped, item) => {
    const existing = grouped.find((candidate) => candidate.description === item.description);
    if (existing) {
      existing.quantity += item.quantity;
      existing.imeis = Array.from(new Set([...existing.imeis.split("\n").filter(Boolean), ...item.imeiList])).join("\n");
    } else {
      grouped.push({ quantity: item.quantity, description: item.description, imeis: item.imeiList.join("\n") });
    }
    return grouped;
  }, []);
}

export function parseInvoiceText(text: string): ExtractedInvoiceData {
  return {
    clientName: extractClient(text),
    invoiceReference: extractInvoiceReference(text),
    items: extractItems(text),
  };
}
