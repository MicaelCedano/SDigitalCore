/**
 * Placeholder para generación de PDFs en servidor.
 * Se implementará completamente en Fase 13.
 */

export interface PDFGeneratorOptions {
  templateId: string;
  data: Record<string, unknown>;
  filename: string;
}

/**
 * Genera un PDF en el servidor.
 * TODO (Fase 13): implementar con react-pdf o puppeteer.
 */
export async function generatePDF(
  options: PDFGeneratorOptions
): Promise<Buffer> {
  throw new Error(
    `[pdf] generatePDF no implementado todavía. Fase 13. Template: ${options.templateId}`
  );
}
