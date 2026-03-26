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

function detectEventTheme(name) {
  const normalizedName = normalizeToken(name);
  if (!normalizedName) return "live";
  if (normalizedName.includes(" vs ") || normalizedName.includes(" at ")) return "sports";
  if (["theater", "theatre", "musical", "ballet", "opera", "show", "play"].some((token) => normalizedName.includes(token))) {
    return "theatre";
  }
  return "live";
}

function hashString(value) {
  let hash = 0;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lig - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildThemePalette(theme, seed) {
  const baseHueByTheme = {
    live: 290,
    sports: 215,
    theatre: 28,
  };

  const baseHue = baseHueByTheme[theme] ?? 290;
  const variation = (seed % 34) - 17;
  const hue = baseHue + variation;

  return [
    hslToHex(hue - 18, 62, 16),
    hslToHex(hue, 72, 40),
    hslToHex(hue + 14, 78, 54),
  ];
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitTitleLines(title, maxLines = 3, maxCharsPerLine = 20) {
  const words = String(title || "Live Event")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return ["Live Event"];

  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length >= maxLines - 1) break;
  }

  const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remainingWords = words.slice(consumedWords);
  const lastLine = [currentLine, ...remainingWords].filter(Boolean).join(" ").trim();

  if (lastLine) {
    lines.push(lastLine);
  }

  const limitedLines = lines.slice(0, maxLines).map((line, index) => {
    if (index === maxLines - 1 && lines.length > maxLines) {
      return `${line.slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}…`;
    }
    if (line.length > maxCharsPerLine + 6) {
      return `${line.slice(0, maxCharsPerLine + 3).trimEnd()}…`;
    }
    return line;
  });

  return limitedLines;
}

function buildPosterFallback(name) {
  const title = String(name || "Live Event").trim() || "Live Event";
  const theme = detectEventTheme(title);
  const labelByTheme = {
    live: "LIVE EVENT",
    sports: "SPORTS EVENT",
    theatre: "LIVE SHOW",
  };
  const seed = hashString(title);
  const palette = buildThemePalette(theme, seed);
  const lines = splitTitleLines(title, 3, 22);
  const safeLines = lines.map(escapeSvgText);
  const label = escapeSvgText(labelByTheme[theme] || "LIVE EVENT");
  const fontSize = safeLines.length >= 3 ? 68 : (safeLines.some((line) => line.length > 18) ? 76 : 88);
  const startY = safeLines.length >= 3 ? 456 : 504;
  const lineHeight = fontSize + 14;
  const titleMarkup = safeLines
    .map((line, index) => `<text x="84" y="${startY + index * lineHeight}" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800">${line}</text>`)
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="55%" stop-color="${palette[1]}" />
          <stop offset="100%" stop-color="${palette[2]}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" rx="34" />
      <circle cx="1030" cy="110" r="170" fill="rgba(255,255,255,0.10)" />
      <circle cx="112" cy="92" r="88" fill="rgba(255,255,255,0.08)" />
      <circle cx="178" cy="684" r="242" fill="rgba(255,255,255,0.07)" />
      <rect x="60" y="60" width="1080" height="680" rx="30" fill="rgba(5,10,18,0.18)" stroke="rgba(255,255,255,0.14)" />
      <rect x="84" y="88" width="226" height="42" rx="21" fill="rgba(255,255,255,0.18)" />
      <text x="112" y="117" fill="rgba(255,255,255,0.92)" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="2">${label}</text>
      <rect x="84" y="356" width="826" height="308" rx="28" fill="rgba(0,0,0,0.24)" />
      ${titleMarkup}
      <text x="86" y="706" fill="rgba(255,255,255,0.82)" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="4">ETICKETS.CA</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveEventImageCandidates(event, options = {}) {
  const { allowMapFallback = false } = options;
  const eventName = String(event?.Name || event?.name || event?.eventName || "").trim();
  const shouldUseArtistPhoto = isLikelyPerformerEvent(eventName);
  const artistPhoto = shouldUseArtistPhoto
    ? `/api/artist-photo?name=${encodeURIComponent(eventName)}`
    : "";
  const posterFallback = buildPosterFallback(eventName);

  // Keep map images fully disabled to avoid venue chart thumbnails in listings.
  void allowMapFallback;
  return [artistPhoto, posterFallback, "/hero.png"].filter(Boolean);
}