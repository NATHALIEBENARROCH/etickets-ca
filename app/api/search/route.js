import { getEvents } from "@/lib/soapClient";
import { corsPreflight, withCorsJson } from "@/lib/cors";

const SEARCH_CACHE_TTL_MS = Number.parseInt(process.env.SEARCH_CACHE_TTL_MS || "120000", 10);
const SEARCH_CACHE_MAX_ITEMS = Number.parseInt(process.env.SEARCH_CACHE_MAX_ITEMS || "100", 10);
const searchCache = new Map();
const SEARCH_DICTIONARY = [
  "coldplay",
  "lady gaga",
  "bruno mars",
  "taylor swift",
  "montreal canadiens",
  "miami heat",
  "toronto",
  "vegas",
  "raptors",
  "leafs",
  "maple leafs",
  "concerts",
  "sports",
  "theater",
];

function normalizeEvents(resultValue) {
  if (!resultValue || resultValue === "") return [];
  if (Array.isArray(resultValue)) return resultValue;
  if (Array.isArray(resultValue.Event)) return resultValue.Event;
  if (resultValue.Event) return [resultValue.Event];
  return [];
}

function toEventTimestamp(event) {
  const rawDate = event?.Date || event?.DisplayDate;
  if (!rawDate) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(rawDate);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
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

function compareEventNames(firstEvent, secondEvent) {
  const firstRawName = String(firstEvent?.Name || "").trim();
  const secondRawName = String(secondEvent?.Name || "").trim();
  const firstName = normalizeToken(firstEvent?.Name);
  const secondName = normalizeToken(secondEvent?.Name);

  if (!firstName && !secondName) return 0;
  if (!firstName) return 1;
  if (!secondName) return -1;

  const firstStartsWithLetter = /^[A-Za-z]/.test(firstRawName);
  const secondStartsWithLetter = /^[A-Za-z]/.test(secondRawName);

  if (firstStartsWithLetter !== secondStartsWithLetter) {
    return firstStartsWithLetter ? -1 : 1;
  }

  return firstName.localeCompare(secondName, "en", { sensitivity: "base" });
}

function sortEventsForListing(events) {
  return [...events].sort((firstEvent, secondEvent) => {
    const byDate = toEventTimestamp(firstEvent) - toEventTimestamp(secondEvent);
    if (byDate !== 0) return byDate;
    return compareEventNames(firstEvent, secondEvent);
  });
}

function cleanQuery(rawQuery) {
  return rawQuery
    .replace(/\b(shows?|events?|tickets?|near me|in|at)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(first, second) {
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let row = 0; row <= a.length; row += 1) matrix[row][0] = row;
  for (let col = 0; col <= b.length; col += 1) matrix[0][col] = col;

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function getTypoCorrectedQuery(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of SEARCH_DICTIONARY) {
    const distance = levenshtein(normalized, candidate);
    const maxLen = Math.max(normalized.length, candidate.length);
    const normalizedDistance = maxLen === 0 ? 0 : distance / maxLen;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = { candidate, normalizedDistance };
    }
  }

  if (!bestCandidate) return null;

  if (bestDistance <= 2 || bestCandidate.normalizedDistance <= 0.25) {
    return bestCandidate.candidate;
  }

  return null;
}

function getTokenReorderCandidates(query) {
  const tokens = normalizeToken(query).split(" ").filter(Boolean);
  if (tokens.length < 2) return [];

  const candidates = [];

  // Most common user mismatch is swapped order (e.g. "yankees new york").
  const reversed = [...tokens].reverse().join(" ");
  candidates.push(reversed);

  if (tokens.length >= 3) {
    candidates.push(`${tokens.slice(1).join(" ")} ${tokens[0]}`);
  }

  return Array.from(new Set(candidates));
}

function getTokenSubsetCandidates(query) {
  const tokens = normalizeToken(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) return [];

  const candidates = [];

  // Use full query first, then likely useful subsets.
  candidates.push(tokens.join(" "));

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    candidates.push(token);
  }

  if (tokens.length >= 2) {
    for (let index = 0; index < tokens.length - 1; index += 1) {
      candidates.push(`${tokens[index]} ${tokens[index + 1]}`);
    }
  }

  return Array.from(new Set(candidates));
}

function uniqueByEventId(events) {
  const seen = new Set();
  const unique = [];

  for (const event of events) {
    const eventId = event?.ID ?? event?.EventID ?? JSON.stringify(event);
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    unique.push(event);
  }

  return unique;
}

function toPerformerKey(event) {
  const name = normalizeToken(event?.Name);
  if (!name) return "";
  return name.split(" ").slice(0, 4).join(" ");
}

function diversifyByPerformer(events) {
  const groups = new Map();
  let unnamedCounter = 0;
  for (const event of events) {
    const performerKey = toPerformerKey(event);
    const fallbackKey = event?.ID != null ? `event-${event.ID}` : `event-unknown-${unnamedCounter++}`;
    const key = performerKey || fallbackKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const queue = Array.from(groups.entries());
  const diversified = [];
  while (queue.length > 0) {
    for (let index = 0; index < queue.length; index += 1) {
      const bucket = queue[index][1];
      if (bucket.length > 0) diversified.push(bucket.shift());
    }
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (queue[index][1].length === 0) queue.splice(index, 1);
    }
  }
  return diversified;
}

function isTributeLikeName(name) {
  const normalizedName = normalizeToken(name);
  if (!normalizedName) return false;

  return [
    " tribute",
    "tribute ",
    "candlelight",
    "featuring the music of",
    "the music of",
    "experience",
  ].some((token) => normalizedName.includes(token));
}

function scoreSearchResult(event, query) {
  const normalizedQuery = normalizeToken(query);
  const normalizedName = normalizeToken(event?.Name);
  const normalizedVenue = normalizeToken(event?.Venue);
  const normalizedCity = normalizeToken(event?.City);

  if (!normalizedQuery || !normalizedName) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (normalizedName === normalizedQuery) score += 120;
  if (normalizedName.startsWith(normalizedQuery)) score += 80;
  if (normalizedName.includes(normalizedQuery)) score += 45;
  if (normalizedVenue.includes(normalizedQuery)) score += 12;
  if (normalizedCity === normalizedQuery) score += 10;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const matchedTokens = queryTokens.filter((token) => normalizedName.includes(token)).length;
  score += matchedTokens * 8;

  if (queryTokens.length > 1 && matchedTokens === queryTokens.length) {
    score += 25;
  }

  if (isTributeLikeName(event?.Name) && normalizedName !== normalizedQuery) {
    score -= 30;
  }

  return score;
}

function sortSearchResults(events, query) {
  return [...events].sort((firstEvent, secondEvent) => {
    const byScore = scoreSearchResult(secondEvent, query) - scoreSearchResult(firstEvent, query);
    if (byScore !== 0) return byScore;

    const byDate = toEventTimestamp(firstEvent) - toEventTimestamp(secondEvent);
    if (byDate !== 0) return byDate;

    return compareEventNames(firstEvent, secondEvent);
  });
}

function isStrongQueryMatch(event, query) {
  const normalizedQuery = normalizeToken(query);
  const normalizedName = normalizeToken(event?.Name);

  if (!normalizedQuery || !normalizedName) return false;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length === 0) return false;

  const matchedTokens = queryTokens.filter((token) => normalizedName.includes(token)).length;
  const hasFullPhrase = normalizedName.includes(normalizedQuery);

  return hasFullPhrase || matchedTokens === queryTokens.length;
}

function shouldPreferChronologicalResults(events, query) {
  const normalizedQuery = normalizeToken(query);
  if (!normalizedQuery || events.length < 2) return false;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length < 2 && normalizedQuery.length < 8) return false;

  const strongMatches = events.filter((event) => isStrongQueryMatch(event, query));
  const strongMatchRatio = strongMatches.length / events.length;

  return strongMatches.length >= 3 && strongMatchRatio >= 0.6;
}

function finalizeSearchResults(events, query) {
  const rankedEvents = sortSearchResults(events, query);

  if (shouldPreferChronologicalResults(rankedEvents, query)) {
    return sortEventsForListing(rankedEvents);
  }

  return diversifyByPerformer(rankedEvents);
}

function toSearchItem(event) {
  return {
    ID: event?.ID,
    Name: event?.Name,
    Venue: event?.Venue,
    City: event?.City,
    StateProvince: event?.StateProvince,
    DisplayDate: event?.DisplayDate || event?.Date,
    MapURL: event?.MapURL,
  };
}

function getCachedResult(cacheKey) {
  const cached = searchCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.createdAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedResult(cacheKey, value) {
  searchCache.set(cacheKey, {
    createdAt: Date.now(),
    value,
  });

  if (searchCache.size <= SEARCH_CACHE_MAX_ITEMS) return;

  const oldest = searchCache.keys().next().value;
  if (oldest) searchCache.delete(oldest);
}

async function runSearch(params) {
  const requestedCount = Number.isFinite(params.numberOfEvents)
    ? Math.max(1, Number(params.numberOfEvents))
    : 20;
  const sourceFetchCount = Math.min(Math.max(requestedCount * 4, requestedCount), 200);

  const response = await getEvents({
    ...params,
    numberOfEvents: sourceFetchCount,
  });
  const events = sortEventsForListing(normalizeEvents(response.parsed?.result));
  return { response, events, requestedCount };
}

export async function GET(request) {
  // leer parámetro q de la URL
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const city = (searchParams.get("city") || "").trim();
  const dateFrom = (searchParams.get("dateFrom") || "").trim();
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const numberOfEvents = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, 200)
    : 20;

  const cacheKey = `${query.toLowerCase()}|${city.toLowerCase()}|${dateFrom.toLowerCase()}|${numberOfEvents}`;

  if (!query) {
    return withCorsJson({ result: [], count: 0, parseError: null }, request);
  }

  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return withCorsJson(cachedResult, request, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  try {
    const baseSearch = await runSearch({
      eventName: query,
      performerName: query,
      cityZip: city || undefined,
      beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
      numberOfEvents,
    });

    let events = baseSearch.events;
    let parseError = baseSearch.response.parseError;
    let fallbackUsed = false;
    let fallbackStrategy = null;
    let correctedQuery = null;

    if (events.length === 0) {
      const cleaned = cleanQuery(query);

      if (cleaned && cleaned.toLowerCase() !== query.toLowerCase()) {
        const cleanedSearch = await runSearch({
          eventName: cleaned,
          performerName: cleaned,
          cityZip: city || undefined,
          beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
          numberOfEvents,
        });

        events = uniqueByEventId([...events, ...cleanedSearch.events]);
        parseError = parseError || cleanedSearch.response.parseError;

        if (cleanedSearch.events.length > 0) {
          fallbackUsed = true;
          fallbackStrategy = "cleaned-query";
          correctedQuery = cleaned;
        }
      }

      if (events.length === 0) {
        const typoCorrected = getTypoCorrectedQuery(cleaned || query);

        if (typoCorrected && typoCorrected.toLowerCase() !== query.toLowerCase()) {
          const typoSearch = await runSearch({
            eventName: typoCorrected,
            performerName: typoCorrected,
            cityZip: city || undefined,
            beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
            numberOfEvents,
          });

          events = uniqueByEventId([...events, ...typoSearch.events]);
          parseError = parseError || typoSearch.response.parseError;

          if (typoSearch.events.length > 0) {
            fallbackUsed = true;
            fallbackStrategy = "typo-correction";
            correctedQuery = typoCorrected;
          }
        }
      }

      if (events.length === 0 && cleaned) {
        const cityVenueSearch = await runSearch({
          cityZip: city || cleaned,
          venueName: cleaned,
          eventName: cleaned,
          beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
          numberOfEvents,
        });

        events = uniqueByEventId([...events, ...cityVenueSearch.events]);
        parseError = parseError || cityVenueSearch.response.parseError;

        if (cityVenueSearch.events.length > 0) {
          fallbackUsed = true;
          fallbackStrategy = "city-venue";
          correctedQuery = cleaned;
        }
      }

      if (events.length === 0) {
        const reorderCandidates = getTokenReorderCandidates(cleaned || query);

        for (const candidate of reorderCandidates) {
          if (!candidate || candidate.toLowerCase() === query.toLowerCase()) continue;

          const reorderedSearch = await runSearch({
            eventName: candidate,
            performerName: candidate,
            cityZip: city || undefined,
            beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
            numberOfEvents,
          });

          events = uniqueByEventId([...events, ...reorderedSearch.events]);
          parseError = parseError || reorderedSearch.response.parseError;

          if (reorderedSearch.events.length > 0) {
            fallbackUsed = true;
            fallbackStrategy = "token-reorder";
            correctedQuery = candidate;
            break;
          }
        }
      }

      if (events.length === 0) {
        const subsetCandidates = getTokenSubsetCandidates(cleaned || query);

        for (const candidate of subsetCandidates) {
          if (!candidate || candidate.toLowerCase() === query.toLowerCase()) continue;

          const subsetSearch = await runSearch({
            eventName: candidate,
            performerName: candidate,
            cityZip: city || undefined,
            beginDate: dateFrom ? `${dateFrom}T00:00:00` : undefined,
            numberOfEvents,
          });

          events = uniqueByEventId([...events, ...subsetSearch.events]);
          parseError = parseError || subsetSearch.response.parseError;

          if (subsetSearch.events.length > 0) {
            fallbackUsed = true;
            fallbackStrategy = "token-subset";
            correctedQuery = candidate;
            break;
          }
        }
      }
    }

    const finalizedEvents = finalizeSearchResults(events, query);
    const totalCount = finalizedEvents.length;
    events = finalizedEvents.slice(0, numberOfEvents).map(toSearchItem);

    const payload = {
      result: events,
      count: totalCount,
      visibleCount: events.length,
      parseError,
      fallbackUsed,
      fallbackStrategy,
      correctedQuery,
    };

    setCachedResult(cacheKey, payload);

    return withCorsJson(payload, request, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error en /api/search:", error);
    return withCorsJson({ error: error.message }, request, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}