import "server-only";

import sharp from "sharp";

const MAX_ANIMATED_IMAGE_BYTES = 1_500_000;

function parseDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:gif|webp));base64,([\s\S]+)$/i);
  if (!match) return null;

  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

/** Compresses animated GIF/WebP avatars without converting them to a static frame. */
export async function fitAnimatedProfileImage(value: string): Promise<string> {
  const parsed = parseDataUrl(value);
  if (!parsed || parsed.buffer.byteLength <= MAX_ANIMATED_IMAGE_BYTES) return value;

  const source = sharp(parsed.buffer, { animated: true, failOn: "error" });
  const metadata = await source.metadata();
  const originalWidth = metadata.width ?? 512;
  const originalHeight = metadata.height ?? 512;
  const frameCount = metadata.pages ?? 1;
  const loop = metadata.loop ?? 0;
  const delay = metadata.delay;

  for (const scale of [0.9, 0.75, 0.6, 0.5, 0.4, 0.3]) {
    const width = Math.max(96, Math.round(originalWidth * scale));
    const height = Math.max(96, Math.round(originalHeight * scale));

    for (const quality of [72, 60, 48, 38]) {
      let pipeline = sharp(parsed.buffer, { animated: frameCount > 1, failOn: "error" }).resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      });

      const output = parsed.mimeType === "image/gif"
        ? await pipeline.gif({ effort: 10, colours: Math.max(32, Math.round(quality * 2.5)) }).toBuffer()
        : await pipeline.webp({ quality, effort: 6, loop, delay }).toBuffer();

      if (output.byteLength <= MAX_ANIMATED_IMAGE_BYTES) {
        return `data:${parsed.mimeType};base64,${output.toString("base64")}`;
      }
    }
  }

  throw new Error("No se pudo comprimir el GIF o WebP por debajo de 1.5 MB.");
}
