import { NextResponse } from "next/server";

const FALLBACK_IMAGE = "/hero.png";

function sanitizeName(value) {
  return (value || "")
    .replace(/\s*[-|•].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findImageFromItunes(name) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=1`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return "";
  const payload = await response.json();
  const first = payload?.results?.[0];
  const artwork = first?.artworkUrl100 || first?.artworkUrl60 || "";
  if (!artwork) return "";

  return String(artwork)
    .replace(/100x100bb/gi, "600x600bb")
    .replace(/60x60bb/gi, "600x600bb")
    .replace(/^http:\/\//i, "https://");
}

async function findImageFromDeezer(name) {
  const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return "";
  const payload = await response.json();
  const first = payload?.data?.[0];
  return (first?.picture_xl || first?.picture_big || first?.picture_medium || "").replace(/^http:\/\//i, "https://");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawName = searchParams.get("name") || "";
  const name = sanitizeName(rawName);

  const fallbackUrl = new URL(FALLBACK_IMAGE, request.url);

  if (!name) {
    return NextResponse.redirect(fallbackUrl, 302);
  }

  try {
    const candidates = [name];
    let imageUrl = "";

    for (const candidate of candidates) {
      imageUrl = await findImageFromItunes(candidate);
      if (imageUrl) break;

      imageUrl = await findImageFromDeezer(candidate);
      if (imageUrl) break;
    }

    const redirectTarget = imageUrl || fallbackUrl.toString();
    const response = NextResponse.redirect(redirectTarget, 302);
    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response;
  } catch {
    return NextResponse.redirect(fallbackUrl, 302);
  }
}
