function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPerformerEvent(event) {
  const name = String(event?.Name || event?.name || event?.eventName || "");
  const normalizedName = normalizeToken(name);
  if (!normalizedName) return false;

  const parentCategoryId = Number.parseInt(String(event?.ParentCategoryID || event?.parentCategoryId || ""), 10);
  if (parentCategoryId === 1) {
    // Sports matchups are rarely performer-photo compatible.
    return false;
  }

  const words = normalizedName.split(" ").filter(Boolean);
  const hasArtistCue = /\b(music of|songs of|tribute to|featuring|feat\.?|starring|celebrating)\b/i.test(name);
  const hasLineupSeparator = /,|&|\band\b|\/|\bx\b/i.test(name);

  // Long titles without lineup separators are usually not performer entities.
  if (!hasLineupSeparator && words.length > 6 && !hasArtistCue) return false;

  const nonPerformerPatterns = [
    /\bvs\b/i,
    /\bat\b/i,
    /\bmusical\b/i,
    /\bplay\b/i,
    /\btheater\b/i,
    /\btheatre\b/i,
    /\bballet\b/i,
    /\bopera\b/i,
    /\borchestra\b/i,
    /\bsymphony\b/i,
    /\bshowcase\b/i,
    /\bcomedy\b/i,
    /\bfestival\b/i,
    /\btribute\b/i,
    /\bbroadway\b/i,
    /\brave\b/i,
    /\btickets?\b/i,
    /\bpass\b/i,
    /\blive\s+show\b/i,
  ];

  if (nonPerformerPatterns.some((pattern) => pattern.test(normalizedName)) && !hasArtistCue) {
    return false;
  }

  if (name.trim().startsWith("&")) {
    return false;
  }

  return true;
}

export function resolveEventImageCandidates(event, options = {}) {
  const { allowMapFallback = false } = options;
  const eventName = String(event?.Name || event?.name || event?.eventName || "").trim();
  const shouldUseArtistPhoto = isLikelyPerformerEvent(event);
  const artistPhoto = shouldUseArtistPhoto
    ? `/api/artist-photo?name=${encodeURIComponent(eventName)}`
    : "";

  // Keep map images fully disabled to avoid venue chart thumbnails in listings.
  void allowMapFallback;
  return [artistPhoto, "/hero.png"].filter(Boolean);
}
