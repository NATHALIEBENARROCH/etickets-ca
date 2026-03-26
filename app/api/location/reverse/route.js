import { corsPreflight, withCorsJson } from "@/lib/cors";

function parseCoordinate(value) {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDetectedCity(value) {
  const city = String(value || "").trim();
  if (!city) return "";

  const cleaned = city
    .replace(/^provincia\s+de\s+/i, "")
    .replace(/^province\s+of\s+/i, "")
    .replace(/^region\s+de\s+/i, "")
    .replace(/^metropolitan\s+region\s+of\s+/i, "")
    .trim();

  return cleaned || city;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"));
  const lon = parseCoordinate(searchParams.get("lon"));

  if (lat == null || lon == null) {
    return withCorsJson({ city: "" }, request, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "etickets-ca/1.0",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return withCorsJson({ city: "" }, request);
    }

    const payload = await response.json();
    const city = normalizeDetectedCity(String(
      payload?.address?.city ||
      payload?.address?.town ||
      payload?.address?.village ||
      payload?.address?.municipality ||
      payload?.address?.county ||
      payload?.address?.state ||
      "",
    ));

    return withCorsJson({ city }, request);
  } catch {
    return withCorsJson({ city: "" }, request);
  }
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}