import { getEvents } from "@/lib/soapClient";
import { corsPreflight, withCorsJson } from "@/lib/cors";

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
    const byName = compareEventNames(firstEvent, secondEvent);
    if (byName !== 0) return byName;

    return toEventTimestamp(firstEvent) - toEventTimestamp(secondEvent);
  });
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

function prioritizeCityMatches(events, city) {
  const normalizedCity = normalizeToken(city);
  if (!normalizedCity) return events;

  const sameCity = [];
  const otherCities = [];

  for (const event of events) {
    const eventCity = normalizeToken(event?.City);
    if (eventCity && eventCity === normalizedCity) {
      sameCity.push(event);
    } else {
      otherCities.push(event);
    }
  }

  return [...sameCity, ...otherCities];
}

function toPerformerKey(event) {
  const name = normalizeToken(event?.Name);
  if (!name) return "";
  return name.split(" ").slice(0, 4).join(" ");
}

function diversifyByPerformer(events) {
  const uniqueHeadliners = [];
  const repeatedHeadliners = [];
  const seen = new Set();

  for (const event of events) {
    const key = toPerformerKey(event);
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      uniqueHeadliners.push(event);
    } else {
      repeatedHeadliners.push(event);
    }
  }

  return [...uniqueHeadliners, ...repeatedHeadliners];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCount = Number.parseInt(searchParams.get("numberOfEvents") || "50", 10);
    const numberOfEvents = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(rawCount, 200) : 50;
    const sourceFetchCount = Math.min(Math.max(numberOfEvents * 4, numberOfEvents), 200);

    const rawParentCategoryID = searchParams.get("parentCategoryID");
    const parentCategoryID = rawParentCategoryID != null && rawParentCategoryID !== ""
      ? Number.parseInt(rawParentCategoryID, 10)
      : undefined;

    const rawChildCategoryID = searchParams.get("childCategoryID");
    const childCategoryID = rawChildCategoryID != null && rawChildCategoryID !== ""
      ? Number.parseInt(rawChildCategoryID, 10)
      : undefined;

    const rawCity = (searchParams.get("city") || "").trim();
    const cityZip = rawCity || undefined;
    const cityScope = (searchParams.get("cityScope") || "").trim().toLowerCase();
    const diversifyParam = (searchParams.get("diversify") || "").trim().toLowerCase();
    const shouldDiversify = diversifyParam === "1" || diversifyParam === "true";
    const orderByClause = (searchParams.get("orderBy") || "Name ASC").trim();

    const result = await getEvents({
      numberOfEvents: sourceFetchCount,
      parentCategoryID: Number.isFinite(parentCategoryID) ? parentCategoryID : undefined,
      childCategoryID: Number.isFinite(childCategoryID) ? childCategoryID : undefined,
      cityZip,
      orderByClause,
    });
    let events = sortEventsForListing(normalizeEvents(result.parsed?.result));

    if (cityZip && cityScope === "city") {
      events = prioritizeCityMatches(events, cityZip);
    }

    if (shouldDiversify) {
      events = diversifyByPerformer(events);
    }

    events = events.slice(0, numberOfEvents);

    return withCorsJson({
      result: events,
      count: events.length,
      parseError: result.parseError,
    }, request);
  } catch (error) {
    console.error("Error en /api/events:", error);
    return withCorsJson({ error: error.message }, request, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}