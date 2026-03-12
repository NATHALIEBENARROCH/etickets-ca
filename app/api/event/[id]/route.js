import { getEvents } from "@/lib/soapClient";
import { corsPreflight, withCorsJson } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEvents(resultValue) {
  if (!resultValue || resultValue === "") return [];
  if (Array.isArray(resultValue)) return resultValue;
  if (Array.isArray(resultValue.Event)) return resultValue.Event;
  if (resultValue.Event) return [resultValue.Event];
  return [];
}

export async function GET(request, ctx) {
  const { id } = await ctx.params;

  const eventId = Number.parseInt(id, 10);
  if (!id || Number.isNaN(eventId)) {
    return withCorsJson({ error: "Invalid event id", got: id }, request, { status: 400 });
  }

  try {
    const result = await getEvents({ eventID: eventId, numberOfEvents: 1 });
    const events = normalizeEvents(result?.parsed?.result);
    const event = events[0] ?? null;

    if (!event) {
      return withCorsJson({ error: "Event not found", parseError: result?.parseError }, request, { status: 404 });
    }

    return withCorsJson({ result: event }, request);
  } catch (error) {
    console.error("Error in /api/event/[id]:", error);
    return withCorsJson({ error: error?.message || "Server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return corsPreflight(request);
}
