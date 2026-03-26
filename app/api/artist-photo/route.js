import { NextResponse } from "next/server";

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

  if (!name) {
    return new NextResponse(null, { status: 404 });
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

    if (!imageUrl) {
      return new NextResponse(null, {
        status: 404,
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      });
    }

    const response = NextResponse.redirect(imageUrl, 302);
    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
