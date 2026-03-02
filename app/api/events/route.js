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

function sortEventsByDate(events) {
  return [...events].sort((firstEvent, secondEvent) => {
    return toEventTimestamp(firstEvent) - toEventTimestamp(secondEvent);
  });
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

    const result = await getEvents({
      numberOfEvents,
      parentCategoryID: Number.isFinite(parentCategoryID) ? parentCategoryID : undefined,
      childCategoryID: Number.isFinite(childCategoryID) ? childCategoryID : undefined,
      cityZip,
    });
    const events = sortEventsByDate(normalizeEvents(result.parsed?.result));

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