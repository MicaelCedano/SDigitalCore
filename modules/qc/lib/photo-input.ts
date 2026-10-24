import sharp from "sharp";
import { z } from "zod";

export const mobilePhotoSchema = z
  .object({
    deviceId: z.string().min(1).max(100),
    commandId: z.string().uuid(),
    base64: z
      .string()
      .min(4)
      .max(1400000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

/** Decode on the server; a client-supplied MIME type is not evidence of an image. */
export async function normalizeQcPhoto(file: File): Promise<File> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Cada foto debe pesar menos de 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, { limitInputPixels: 40000000, animated: false });
  const metadata = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format || "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Selecciona una foto JPEG, PNG o WebP válida.");
  const normalized = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
  return new File([new Uint8Array(normalized)], "evidencia.webp", {
    type: "image/webp",
  });
}
