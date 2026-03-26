import { corsPreflight, withCorsJson } from "@/lib/cors";

function firstForwardedIp(headers) {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const first = forwardedFor.split(",")[0]?.trim();
  return first || "";
}

async function fetchWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveCity(ip) {
  // Try both endpoints in parallel for faster detection
  const endpoints = [
    ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/",
    ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/",
  ];

  const promises = endpoints.map(async (endpoint) => {
    try {
      const response = await fetchWithTimeout(endpoint, 1500);
      if (!response.ok) return null;

      const payload = await response.json();
      const city = String(
        payload?.city ||
        payload?.region ||
        payload?.regionName ||
        payload?.data?.city ||
        "",
      ).trim();
      return city || null;
    } catch {
      return null;
    }
  });

  // Return first successful result (Promise.race)
  const results = await Promise.all(promises);
  for (const city of results) {
    if (city) return city;
  }

  return "";
}

export async function GET(request) {
  const providerCity = String(
    request.headers.get("x-vercel-ip-city") ||
    request.headers.get("x-city") ||
    "",
  ).trim();
  if (providerCity) {
    return withCorsJson({ city: providerCity }, request);
  }

  const ip = firstForwardedIp(request.headers);
  const city = await resolveCity(ip);
  return withCorsJson({ city }, request);
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}
