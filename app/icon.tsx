import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export default function Icon() {
  try {
    const filePath = path.join(process.cwd(), "public", "logo.png");
    const buffer = fs.readFileSync(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Icon not found", { status: 404 });
  }
}
