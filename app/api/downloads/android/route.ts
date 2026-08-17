const APK_SOURCE = "https://github.com/MicaelCedano/SDigitalCore/releases/download/v0.1.5/SDigitalCore_0.1.5_android-arm64-signed.apk";

export async function GET() {
  const upstream = await fetch(APK_SOURCE, {
    headers: { Accept: "application/octet-stream", "User-Agent": "SDigitalCore-download-proxy" },
    cache: "no-store",
    redirect: "follow",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("No se pudo preparar la descarga.", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="SDigitalCore_0.1.5_android-arm64-signed.apk"',
    "Cache-Control": "public, max-age=3600",
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { headers });
}
