import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import EventSeatMap from "@/app/components/EventSeatMap";

const PREFERRED_CHECKOUT_HOST = "checkout.ticketsbuzz.com";

function sanitizeCheckoutDomain(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return PREFERRED_CHECKOUT_HOST;

  try {
    const normalized = raw.includes("://") ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    const host = (parsed.hostname || "").toLowerCase();
    if (!host || host.endsWith("etickets.ca")) return PREFERRED_CHECKOUT_HOST;
    return host;
  } catch {
    const lower = raw.toLowerCase();
    if (lower.includes("etickets.ca")) return PREFERRED_CHECKOUT_HOST;
    return lower.replace(/^https?:\/\//, "").split("/")[0] || PREFERRED_CHECKOUT_HOST;
  }
}

function sanitizeCheckoutUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.toLowerCase().endsWith("etickets.ca")) return raw;
    parsed.protocol = "https:";
    parsed.hostname = PREFERRED_CHECKOUT_HOST;
    parsed.port = "";
    return parsed.toString();
  } catch {
    return raw.replace(/checkout\.etickets\.ca/gi, PREFERRED_CHECKOUT_HOST);
  }
}

type EventItem = {
  ID: number;
  Name?: string;
  City?: string;
  StateProvince?: string;
  Venue?: string;
  DisplayDate?: string;

  MapURL?: string;
  InteractiveMapURL?: string;

  TicketURL?: string;
  ExternalURL?: string;
  Url?: string;
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("host") || "";
  const isLocalRequest = requestHost.includes("localhost") || requestHost.includes("127.0.0.1");
  const requestProto = requestHeaders.get("x-forwarded-proto") || (requestHost.includes("localhost") ? "http" : "https");
  const currentOrigin = requestHost ? `${requestProto}://${requestHost}` : baseUrl;

  // ✅ IMPORTANT: event details must call /api/event/:id (singular)
  let res: Response;
  try {
    res = await fetch(`${currentOrigin}/api/event/${id}`, { cache: "no-store" });
  } catch {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Event not available</h1>
        <p style={{ color: "#b00020" }}>Couldn&apos;t load event details right now.</p>
        <Link href="/events">← Back to events</Link>
      </main>
    );
  }

  if (!res.ok) {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Event not available</h1>
        <p style={{ color: "#b00020" }}>HTTP {res.status}</p>
        <Link href="/events">← Back to events</Link>
      </main>
    );
  }

  // ✅ THIS is the part you asked about:
  // API returns: { result: event }
  const data = await res.json();
  const event: EventItem | null = data?.result ?? null;

  if (!event) {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Event not available</h1>
        <Link href="/events">← Back to events</Link>
      </main>
    );
  }

  const wcid = process.env.TN_WCID || "";
  const ticketLink = `https://www.ticketnetwork.com/tickets/${event.ID}?wcid=${wcid}`;
  const requireMapInteractionBeforeBuy =
    process.env.NEXT_PUBLIC_REQUIRE_MAP_INTERACTION_BEFORE_BUY === "true";
  const c2CheckoutUrl = isLocalRequest
    ? sanitizeCheckoutUrl(
        process.env.TN_SEATICS_CHECKOUT_URL || process.env.NEXT_PUBLIC_TN_SEATICS_CHECKOUT_URL || "",
      )
    : "";
  const envUseC3Checkout =
    (process.env.TN_SEATICS_USE_C3 || process.env.NEXT_PUBLIC_TN_SEATICS_USE_C3 || "").toLowerCase() === "true";
  const c3CheckoutDomain = sanitizeCheckoutDomain(
    process.env.TN_SEATICS_C3_CHECKOUT_DOMAIN || process.env.NEXT_PUBLIC_TN_SEATICS_C3_CHECKOUT_DOMAIN || "",
  );
  const useC3Checkout = !isLocalRequest || envUseC3Checkout;
  const c3CurrencyCode =
    process.env.TN_SEATICS_C3_CURRENCY_CODE || process.env.NEXT_PUBLIC_TN_SEATICS_C3_CURRENCY_CODE || "";
  const c3UtmSource =
    process.env.TN_SEATICS_C3_UTM_SOURCE || process.env.NEXT_PUBLIC_TN_SEATICS_C3_UTM_SOURCE || "";
  const c3UtmMedium =
    process.env.TN_SEATICS_C3_UTM_MEDIUM || process.env.NEXT_PUBLIC_TN_SEATICS_C3_UTM_MEDIUM || "";
  const c3UtmCampaign =
    process.env.TN_SEATICS_C3_UTM_CAMPAIGN || process.env.NEXT_PUBLIC_TN_SEATICS_C3_UTM_CAMPAIGN || "";
  const c3UtmContent =
    process.env.TN_SEATICS_C3_UTM_CONTENT || process.env.NEXT_PUBLIC_TN_SEATICS_C3_UTM_CONTENT || "";
  const c3UtmTerm =
    process.env.TN_SEATICS_C3_UTM_TERM || process.env.NEXT_PUBLIC_TN_SEATICS_C3_UTM_TERM || "";
  const c3PromoCode =
    process.env.TN_SEATICS_C3_PROMO_CODE || process.env.NEXT_PUBLIC_TN_SEATICS_C3_PROMO_CODE || "";
  const forceScriptMode = false;

  const venueQuery = [event.Venue, event.City, event.StateProvince]
    .filter(Boolean)
    .join(" ");
  const venueMapLink = venueQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        venueQuery,
      )}`
    : "";

  return (
    <main style={{ padding: 40, fontFamily: "Arial", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/events">← Back to events</Link>
      </div>

      <h1 style={{ fontSize: 36, marginBottom: 6 }}>{event.Name}</h1>

      <div style={{ color: "#555", marginBottom: 6 }}>
        📍 {event.Venue}
        {event.Venue && event.City ? " • " : ""}
        {event.City}
        {event.City && event.StateProvince ? ", " : ""}
        {event.StateProvince}
      </div>

      <div style={{ color: "#777", marginBottom: 20 }}>
        🗓 {formatEventDate(event.DisplayDate)}
      </div>

      <section style={{ marginTop: 24 }}>
        <div
          style={{
            maxWidth: 1020,
            margin: "0 auto",
            padding: "14px 14px 18px",
            borderRadius: 16,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(255, 255, 255, 0.03)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}>Seat map</h2>
          <p style={{ color: "#999", textAlign: "center", marginBottom: 12 }}>
            Browse sections and prices directly in the map.
          </p>

          <EventSeatMap
            key={`seatmap-${event.ID}-${wcid}`}
            eventId={event.ID}
            interactiveMapUrl={event.InteractiveMapURL}
            ticketLink={ticketLink}
            wcid={wcid}
            forceScriptMode={forceScriptMode}
            checkoutConfig={{
              c2CheckoutUrl,
              useC3: useC3Checkout,
              c3CheckoutDomain,
              c3CurrencyCode,
              c3UtmSource,
              c3UtmMedium,
              c3UtmCampaign,
              c3UtmContent,
              c3UtmTerm,
              c3PromoCode,
            }}
          />
        </div>
      </section>


      <section style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {ticketLink ? (
          <Link
            href={`/event/${id}/tickets`}
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Buy tickets
          </Link>
        ) : (
          <span style={{ color: "#777" }}>
            (No ticket link in this data yet)
          </span>
        )}
      </section>

      {requireMapInteractionBeforeBuy ? (
        <p style={{ color: "#777", marginTop: 12, textAlign: "center" }}>
          Select your seats in the interactive map above.
        </p>
      ) : null}

      {venueMapLink ? (
        <section style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <a
            href={venueMapLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Venue map
          </a>
        </section>
      ) : null}

      {/* Políticas al final de la página */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 40, marginBottom: 10 }}>
        <Link href="/policy" style={{
          background: "#181c3a",
          color: "#fff",
          padding: "10px 28px",
          borderRadius: 24,
          fontWeight: 700,
          fontSize: 20,
          textDecoration: "none"
        }}>Policy / Terms & Conditions</Link>
      </div>
    </main>
  );
}
