import { corsPreflight, withCorsJson } from "@/lib/cors";

function firstForwardedIp(headers) {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const first = forwardedFor.split(",")[0]?.trim();
  return first || "";
}

async function resolveCity(ip) {
  const endpoints = [
    ip ? `https://ipinfo.io/${encodeURIComponent(ip)}/json` : "https://ipinfo.io/json",
    "https://ipinfo.io/json",
    "http://ip-api.com/json",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;

      const payload = await response.json();
      const city = String(payload?.city || payload?.region || payload?.regionName || "").trim();
      if (city) return city;
    } catch {
      // Try next endpoint.
    }
  }

  return "";
}

export async function GET(request) {
  const ip = firstForwardedIp(request.headers);
  const city = await resolveCity(ip);
  return withCorsJson({ city }, request);
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}
