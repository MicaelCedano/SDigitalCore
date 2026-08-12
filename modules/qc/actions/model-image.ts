"use server";

import * as cheerio from "cheerio";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

const searchModelImageSchema = z.object({
  brand: z.string().max(60).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  color: z.string().max(60).optional().nullable(),
  offset: z.number().int().min(0).max(20).optional().default(0),
});

interface ImageResult {
  url: string;
  thumbnail: string;
}

// Misma técnica que SDigitalSystem (image-service.ts): scrape de Bing Images.
function cleanVisualQuery(query: string): string {
  return query.replace(/\s\d+\s?GB/gi, "").replace(/\s\d+\s?TB/gi, "").trim();
}

async function searchBingImages(query: string, limit = 8, offset = 0): Promise<ImageResult[]> {
  try {
    const first = offset * limit + 1;
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=${first}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Bing search failed");

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: ImageResult[] = [];

    $("a.iusc").each((_, el) => {
      if (results.length >= limit) return;
      try {
        const m = $(el).attr("m");
        if (m) {
          const data = JSON.parse(m);
          if (data.murl && data.turl) {
            results.push({ url: data.murl, thumbnail: data.turl });
          }
        }
      } catch {
        // ignorar resultados que no se puedan parsear
      }
    });

    return results;
  } catch (error) {
    console.error("Error searching Bing Images:", error);
    return [];
  }
}

/**
 * Imagen de referencia guardada para un modelo (configuración → Imágenes de QC).
 * El modal de revisión la carga automáticamente si existe; si no, el QC
 * puede buscarla en internet igual.
 */
export async function getModelImageAction(input: { brand?: string | null; model?: string | null }) {
  try {
    await requirePermission("qc.read");

    const brand = (input.brand || "").trim().toUpperCase();
    const model = (input.model || "").trim().toUpperCase();
    if (!brand || !model) return { success: true, data: null };

    const image = await prisma.qcModelImage.findUnique({
      where: { brand_model: { brand, model } },
      select: { imageUrl: true },
    });

    return { success: true, data: image?.imageUrl ?? null };
  } catch (error: any) {
    console.error("Error al consultar imagen del modelo:", error);
    return { success: false, error: error.message || "Error al consultar la imagen del modelo", data: null };
  }
}

/**
 * Busca en internet una imagen de referencia del modelo (fórmula SDigitalSystem:
 * "marca modelo color official"). Solo lectura — no guarda nada en la BD.
 */
export async function searchModelImageAction(input: z.input<typeof searchModelImageSchema>) {
  try {
    await requirePermission("qc.read");

    const validated = searchModelImageSchema.parse(input);
    const raw = `${validated.brand || ""} ${validated.model || ""} ${validated.color || ""} official png`
      .replace(/\s+/g, " ")
      .trim();
    const query = cleanVisualQuery(raw);

    if (query.length < 3) {
      return { success: false, error: "Falta información del modelo para buscar la imagen.", data: [] };
    }

    const data = await searchBingImages(query, 8, validated.offset ?? 0);
    if (data.length === 0) {
      return { success: false, error: "No se encontraron imágenes del modelo.", data: [] };
    }

    return { success: true, data, query };
  } catch (error: any) {
    console.error("Error al buscar imagen del modelo:", error);
    return { success: false, error: error.message || "Error al buscar la imagen del modelo", data: [] };
  }
}
