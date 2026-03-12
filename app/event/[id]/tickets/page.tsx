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
  InteractiveMapURL?: string;
};

export default async function EventTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("host") || "";
  const isLocalRequest = requestHost.includes("localhost") || requestHost.includes("127.0.0.1");
  const requestProto =
    requestHeaders.get("x-forwarded-proto") ||
    (requestHost.includes("localhost") ? "http" : "https");
  const currentOrigin = requestHost ? `${requestProto}://${requestHost}` : baseUrl;

  let res: Response;
  try {
    res = await fetch(`${currentOrigin}/api/event/${id}`, { cache: "no-store" });
  } catch {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Tickets not available</h1>
        <p style={{ color: "#b00020" }}>Couldn&apos;t load interactive tickets right now.</p>
        <Link href={`/event/${id}`}>← Back to event details</Link>
      </main>
    );
  }

  if (!res.ok) {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Tickets not available</h1>
        <p style={{ color: "#b00020" }}>HTTP {res.status}</p>
        <Link href={`/event/${id}`}>← Back to event details</Link>
      </main>
    );
  }

  const data = await res.json();
  const event: EventItem | null = data?.result ?? null;

  if (!event) {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Tickets not available</h1>
        <Link href={`/event/${id}`}>← Back to event details</Link>
      </main>
    );
  }

  const wcid = process.env.TN_WCID || "";
  const ticketLink = `https://www.ticketnetwork.com/tickets/${event.ID}?wcid=${wcid}`;
  const enableExternalCheckout =
    process.env.NEXT_PUBLIC_TN_ENABLE_EXTERNAL_CHECKOUT === "true";
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

  return (
    <main style={{ padding: 40, fontFamily: "Arial", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/event/${event.ID}`}>← Back to event details</Link>
      </div>

      <h1 style={{ fontSize: 34, marginBottom: 6 }}>{event.Name}</h1>
      <div style={{ color: "#555", marginBottom: 4 }}>
        {event.Venue}
        {event.Venue && event.City ? " • " : ""}
        {event.City}
        {event.City && event.StateProvince ? ", " : ""}
        {event.StateProvince}
      </div>
      <div style={{ color: "#777", marginBottom: 18 }}>
        {formatEventDate(event.DisplayDate)}
      </div>

      <section>
        <h2 style={{ fontSize: 19, marginBottom: 10 }}>Interactive seat map</h2>
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
      </section>

      <section style={{ marginTop: 20, textAlign: "center" }}>
        {enableExternalCheckout ? (
          <a
            href={ticketLink}
            target="_blank"
            rel="noreferrer"
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
            Continue to checkout
          </a>
        ) : (
          <p style={{ color: "#777" }}>
            Checkout in TicketsBuzz is being prepared. For now, seat selection stays in-page.
          </p>
        )}
      </section>
    </main>
  );

  return (
    <main style={{ padding: 40, fontFamily: "Arial", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/event/${event.ID}`}>← Back to event details</Link>
      </div>

      <h1 style={{ fontSize: 34, marginBottom: 6 }}>{event.Name}</h1>
      <div style={{ color: "#555", marginBottom: 4 }}>
        {event.Venue}
        {event.Venue && event.City ? " • " : ""}
        {event.City}
        {event.City && event.StateProvince ? ", " : ""}
        {event.StateProvince}
      </div>
      <div style={{ color: "#777", marginBottom: 18 }}>
        {formatEventDate(event.DisplayDate)}
      </div>

      <section>
        <h2 style={{ fontSize: 19, marginBottom: 10 }}>Interactive seat map</h2>
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
      </section>

      <section style={{ marginTop: 20, textAlign: "center" }}>
        {enableExternalCheckout ? (
          <a
            href={ticketLink}
            target="_blank"
            rel="noreferrer"
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
            Continue to checkout
          </a>
        ) : (
          <p style={{ color: "#777" }}>
            Checkout in TicketsBuzz is being prepared. For now, seat selection stays in-page.
          </p>
        )}
      </section>
    </main>
  );
}
