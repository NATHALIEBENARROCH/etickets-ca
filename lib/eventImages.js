function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPerformerEvent(name) {
  const normalizedName = normalizeToken(name);
  if (!normalizedName) return false;

  const nonPerformerSignals = [
    " vs ",
    " at ",
    " the musical",
    " musical",
    " play",
    " theater",
    " theatre",
    " ballet",
    " opera",
    " orchestra",
    " symphony",
    " showcase",
    " comedy",
    " festival",
    " tribute",
  ];

  if (nonPerformerSignals.some((signal) => normalizedName.includes(signal))) {
    return false;
  }

  if (normalizedName.includes(":")) {
    return false;
  }

  return true;
}

export function resolveEventImageCandidates(event, options = {}) {
  const { allowMapFallback = true } = options;
  const raw = String(event?.MapURL || "").trim();
  const eventName = String(event?.Name || event?.name || event?.eventName || "").trim();
  const shouldUseArtistPhoto = isLikelyPerformerEvent(eventName);
  const artistPhoto = shouldUseArtistPhoto
    ? `/api/artist-photo?name=${encodeURIComponent(eventName)}`
    : "";

  if (!allowMapFallback) {
    return [artistPhoto, "/hero.png"].filter(Boolean);
  }

  if (!raw) {
    return [artistPhoto, "/hero.png"].filter(Boolean);
  }

  const normalizedMapUrl = raw.toLowerCase();
  const hasGenericMapKeyword = [
    "generaladmissionevent",
    "seat",
    "seating",
    "venue",
    "map",
    "chart",
    "floorplan",
  ].some((keyword) => normalizedMapUrl.includes(keyword));

  const secureMapUrl = raw.replace(/^http:\/\//i, "https://");

  if (hasGenericMapKeyword || normalizedMapUrl.endsWith(".gif")) {
    return shouldUseArtistPhoto
      ? [artistPhoto, secureMapUrl, "/hero.png"].filter(Boolean)
      : [secureMapUrl, "/hero.png"].filter(Boolean);
  }

  return [secureMapUrl, artistPhoto, "/hero.png"].filter(Boolean);
}