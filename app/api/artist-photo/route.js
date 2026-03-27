import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function sanitizeName(value) {
  return (value || "")
    .replace(/\s*[-|•].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameCandidates(rawName) {
  const base = sanitizeName(rawName);
  const candidates = new Set([base]);

  const stripped = base
    .replace(/\b(feat|featuring|with|and friends|live|tour|show)\b.*$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped) candidates.add(stripped);

  const beforeColon = base.split(":")[0]?.trim();
  const afterColon = base.split(":").slice(1).join(":").trim();
  if (beforeColon) candidates.add(beforeColon);
  if (afterColon) candidates.add(afterColon);

  const beforeDash = base.split("-")[0]?.trim();
  if (beforeDash) candidates.add(beforeDash);

  const lineupPrimary = base
    .split(",")[0]
    ?.split("&")[0]
    ?.split(" and ")[0]
    ?.split("/")[0]
    ?.split(" x ")[0]
    ?.trim();
  if (lineupPrimary) candidates.add(lineupPrimary);

  const phraseExtractors = [
    /(?:music|songs)\s+of\s+([^:,-]+)/i,
    /tribute\s+to\s+([^:,-]+)/i,
    /featuring\s+([^:,-]+)/i,
    /starring\s+([^:,-]+)/i,
    /celebrating\s+([^:,-]+)/i,
  ];

  for (const pattern of phraseExtractors) {
    const match = base.match(pattern);
    const extracted = match?.[1]?.trim();
    if (extracted) candidates.add(extracted);
  }

  const normalizedCandidates = Array.from(candidates)
    .map((item) => item
      .replace(/\b(a|an|the)\s+(symphonic|orchestral|musical)\b/gi, "")
      .replace(/\b(tribute|experience|live|in concert|tour)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean);

  const tokens = base.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    normalizedCandidates.push(`${tokens[0]} ${tokens[1]}`);
  }

  return Array.from(new Set(normalizedCandidates)).filter(Boolean);
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStrongNameMatch(query, candidate) {
  const queryNormalized = normalizeToken(query);
  const candidateNormalized = normalizeToken(candidate);
  if (!queryNormalized || !candidateNormalized) return false;
  if (queryNormalized === candidateNormalized) return true;

  const queryTokens = queryNormalized
    .split(" ")
    .filter((token) => token.length >= 3);

  if (queryTokens.length === 0) return false;

  const candidateTokenSet = new Set(candidateNormalized.split(" ").filter(Boolean));

  if (queryTokens.length === 1) {
    const token = queryTokens[0];
    return token.length >= 4 && candidateTokenSet.has(token);
  }

  return queryTokens.every((token) => candidateTokenSet.has(token));
}

async function findImageFromItunes(name) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=12`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return "";
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const first = results.find((item) => isStrongNameMatch(name, item?.artistName));
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
  const artists = Array.isArray(payload?.data) ? payload.data : [];
  const first = artists.find((item) => isStrongNameMatch(name, item?.name));
  return (first?.picture_xl || first?.picture_big || first?.picture_medium || "").replace(/^http:\/\//i, "https://");
}

async function createHeroFallbackResponse() {
  try {
    const heroPath = join(process.cwd(), "public", "hero.png");
    const bytes = await readFile(heroPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "X-Image-Source": "fallback",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawName = searchParams.get("name") || "";
  const name = sanitizeName(rawName);

  if (!name) {
    return createHeroFallbackResponse();
  }

  try {
    const candidates = buildNameCandidates(name);
    let imageUrl = "";

    for (const candidate of candidates) {
      imageUrl = await findImageFromDeezer(candidate);
      if (imageUrl) break;

      imageUrl = await findImageFromItunes(candidate);
      if (imageUrl) break;

      // Keep sources conservative to avoid mismatched people photos.
    }

    if (!imageUrl) return createHeroFallbackResponse();

    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: "image/*",
        "User-Agent": "etickets-ca/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) return createHeroFallbackResponse();

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return createHeroFallbackResponse();
    }
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Image-Source": "external",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return createHeroFallbackResponse();
  }
}
