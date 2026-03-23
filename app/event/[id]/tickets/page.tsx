import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import { getEnv } from "@/lib/env";
import EventSeatMap from "@/app/components/EventSeatMap";

function sanitizeCheckoutDomain(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const normalized = raw.includes("://") ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    const host = (parsed.hostname || "").toLowerCase();

    if (!host) return "";

    return host;
  } catch {
    const lower = raw.toLowerCase();
    return lower.replace(/^https?:\/\//, "").split("/")[0] || "";
  }
}

function sanitizeCheckoutUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return parsed.toString();
  } catch {
    return raw;
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

  const isLocalRequest =
    requestHost.includes("localhost") || requestHost.includes("127.0.0.1");

  const requestProto =
    requestHeaders.get("x-forwarded-proto") ||
    (requestHost.includes("localhost") ? "http" : "https");

  const currentOrigin = requestHost
    ? `${requestProto}://${requestHost}`
    : baseUrl;

  let res: Response;

  try {
    res = await fetch(`${currentOrigin}/api/event/${id}`, {
      cache: "no-store",
    });
  } catch {
    return (
      <main style={{ padding: 40, fontFamily: "Arial" }}>
        <h1 style={{ fontSize: 28 }}>Tickets not available</h1>
        <p style={{ color: "#b00020" }}>
          Couldn&apos;t load interactive tickets right now.
        </p>
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

  const safeEvent = event;

  const wcid = getEnv("TN_WCID", "WCID");
  const ticketLink = `https://www.ticketnetwork.com/tickets/${safeEvent.ID}?wcid=${wcid}`;

  const enableExternalCheckout =
    process.env.NEXT_PUBLIC_TN_ENABLE_EXTERNAL_CHECKOUT === "true";

  const c2CheckoutUrl = isLocalRequest
    ? sanitizeCheckoutUrl(
        getEnv(
          "TN_SEATICS_CHECKOUT_URL",
          "NEXT_PUBLIC_TN_SEATICS_CHECKOUT_URL",
        ),
      )
    : "";

  const envUseC3Checkout =
    (
      getEnv("TN_SEATICS_USE_C3", "NEXT_PUBLIC_TN_SEATICS_USE_C3")
    ).toLowerCase() === "true";

  const c3CheckoutDomain = sanitizeCheckoutDomain(
    getEnv(
      "TN_SEATICS_C3_CHECKOUT_DOMAIN",
      "NEXT_PUBLIC_TN_SEATICS_C3_CHECKOUT_DOMAIN",
    ),
  );

  const useC3Checkout = envUseC3Checkout && Boolean(c3CheckoutDomain);

  const c3CurrencyCode =
    getEnv("TN_SEATICS_C3_CURRENCY_CODE", "NEXT_PUBLIC_TN_SEATICS_C3_CURRENCY_CODE");

  const c3UtmSource =
    getEnv("TN_SEATICS_C3_UTM_SOURCE", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_SOURCE");

  const c3UtmMedium =
    getEnv("TN_SEATICS_C3_UTM_MEDIUM", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_MEDIUM");

  const c3UtmCampaign =
    getEnv("TN_SEATICS_C3_UTM_CAMPAIGN", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_CAMPAIGN");

  const c3UtmContent =
    getEnv("TN_SEATICS_C3_UTM_CONTENT", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_CONTENT");

  const c3UtmTerm =
    getEnv("TN_SEATICS_C3_UTM_TERM", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_TERM");

  const c3PromoCode =
    getEnv("TN_SEATICS_C3_PROMO_CODE", "NEXT_PUBLIC_TN_SEATICS_C3_PROMO_CODE");

  const forceScriptMode = false;

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <Link href={`/event/${safeEvent.ID}`}>← Back to event details</Link>
      </div>

      <h1 style={{ fontSize: 34, marginBottom: 6 }}>{safeEvent.Name}</h1>

      <div style={{ color: "#555", marginBottom: 4 }}>
        {safeEvent.Venue}
        {safeEvent.Venue && safeEvent.City ? " • " : ""}
        {safeEvent.City}
        {safeEvent.City && safeEvent.StateProvince ? ", " : ""}
        {safeEvent.StateProvince}
      </div>

      <div style={{ color: "#777", marginBottom: 18 }}>
        {formatEventDate(safeEvent.DisplayDate)}
      </div>

      <section>
        <h2 style={{ fontSize: 19, marginBottom: 10 }}>Interactive seat map</h2>
        <EventSeatMap
          key={`seatmap-${safeEvent.ID}-${wcid}`}
          eventId={safeEvent.ID}
          interactiveMapUrl={safeEvent.InteractiveMapURL}
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
            Checkout in TicketsBuzz is being prepared. For now, seat selection
            stays in-page.
          </p>
        )}
      </section>
    </main>
  );
}
