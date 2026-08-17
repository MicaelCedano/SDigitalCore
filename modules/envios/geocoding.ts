type GeocodeResult = { lat: string; lon: string; display_name: string };

export type GeocodedAddress = { latitude: number; longitude: number; label: string };

export async function geocodeAddress(address: string, mapsUrl: string | null): Promise<GeocodedAddress> {
  if (mapsUrl) {
    try {
      const response = await fetch(mapsUrl, { redirect: "follow", cache: "no-store" });
      const match = response.url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (match) return { latitude: Number(match[1]), longitude: Number(match[2]), label: address };
    } catch { /* Usamos geocodificación por texto si el enlace requiere sesión. */ }
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "do");
  url.searchParams.set("q", `${address}, República Dominicana`);
  const response = await fetch(url, { headers: { "User-Agent": "SDigitalCore/0.1.5 shipment routing" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("No se pudo localizar la dirección.");
  const result = (await response.json() as GeocodeResult[])[0];
  if (!result) throw new Error(`No encontramos la dirección "${address}" en República Dominicana.`);
  return { latitude: Number(result.lat), longitude: Number(result.lon), label: result.display_name };
}
