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

function sortEventsForListing(events, { city, cityScope } = {}) {
  const normalizedCity = cityScope === "city" ? normalizeToken(city) : "";

  return [...events].sort((firstEvent, secondEvent) => {
    if (normalizedCity) {
      const firstIsCityMatch = normalizeToken(firstEvent?.City) === normalizedCity;
      const secondIsCityMatch = normalizeToken(secondEvent?.City) === normalizedCity;
      if (firstIsCityMatch !== secondIsCityMatch) {
        return firstIsCityMatch ? -1 : 1;
      }
    }

    const byDate = toEventTimestamp(firstEvent) - toEventTimestamp(secondEvent);
    if (byDate !== 0) return byDate;

    return compareEventNames(firstEvent, secondEvent);
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
      if (bucket.length > 0) {
        diversified.push(bucket.shift());
      }
    }
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (queue[index][1].length === 0) {
        queue.splice(index, 1);
      }
    }
  }

  return diversified;
}

function parseDateInput(value) {
  const cleaned = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return "";
  const parsed = new Date(`${cleaned}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return cleaned;
}

function toSoapBoundary(date, boundary) {
  if (!date) return undefined;
  return boundary === "end"
    ? `${date}T23:59:59`
    : `${date}T00:00:00`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCount = Number.parseInt(searchParams.get("numberOfEvents") || "50", 10);
    const numberOfEvents = Number.isFinite(rawCount) && rawCount > 0 ? Math.min(rawCount, 200) : 50;

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
    const rawCountryId = Number.parseInt(searchParams.get("countryId") || "", 10);
    const countryId = Number.isFinite(rawCountryId) && rawCountryId > 0 ? rawCountryId : undefined;
    const countryScope = (searchParams.get("countryScope") || "").trim().toLowerCase();
    const diversifyParam = (searchParams.get("diversify") || "").trim().toLowerCase();
    const shouldDiversify = diversifyParam === "1" || diversifyParam === "true";
    const dateFrom = parseDateInput(searchParams.get("dateFrom"));
    const dateTo = parseDateInput(searchParams.get("dateTo"));

    let beginDate = dateFrom;
    let endDate = dateTo;
    if (beginDate && endDate && beginDate > endDate) {
      beginDate = dateTo;
      endDate = dateFrom;
    }

    const orderByParam = (searchParams.get("orderBy") || "").trim();
    const orderByClause = orderByParam || "Date ASC";
    const whereClause = countryScope === "country" && countryId
      ? `CountryID = ${countryId}`
      : undefined;
    const shouldFetchWide =
      shouldDiversify ||
      cityScope === "city" ||
      countryScope === "country" ||
      Boolean(cityZip) ||
      Boolean(countryId);
    const sourceFetchCount = shouldFetchWide
      ? 200
      : Math.min(Math.max(numberOfEvents * 4, numberOfEvents), 200);

    const result = await getEvents({
      numberOfEvents: sourceFetchCount,
      parentCategoryID: Number.isFinite(parentCategoryID) ? parentCategoryID : undefined,
      childCategoryID: Number.isFinite(childCategoryID) ? childCategoryID : undefined,
      cityZip,
      whereClause,
      beginDate: toSoapBoundary(beginDate, "start"),
      endDate: toSoapBoundary(endDate, "end"),
      orderByClause,
    });
    let events = sortEventsForListing(normalizeEvents(result.parsed?.result), {
      city: cityZip,
      cityScope,
    });

    if (countryScope === "country" && countryId) {
      events = events.filter((event) => Number.parseInt(String(event?.CountryID || ""), 10) === countryId);
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