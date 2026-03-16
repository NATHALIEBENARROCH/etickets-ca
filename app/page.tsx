import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import HeroSearch from "@/app/components/HeroSearch";
import AutoGeoCity from "@/app/components/AutoGeoCity";
import EventCardImage from "@/app/components/EventCardImage";
import GeoCarouselIndicators from "@/app/components/GeoCarouselIndicators";

type EventItem = {
  ID: number;
  Name?: string;
  City?: string;
  Venue?: string;
  DisplayDate?: string;
  MapURL?: string;
};

function resolveEventImageCandidates(event: EventItem) {
  const raw = (event.MapURL || "").trim();
  const artistName = (event.Name || "").trim();
  const artistPhoto = artistName
    ? `/api/artist-photo?name=${encodeURIComponent(artistName)}`
    : "";

  if (!raw) {
    return [artistPhoto, "/hero.png"].filter(Boolean);
  }

  const normalized = raw.toLowerCase();
  const hasGenericMapKeyword = [
    "generaladmissionevent",
    "seat",
    "seating",
    "venue",
    "map",
    "chart",
    "floorplan",
  ].some((keyword) => normalized.includes(keyword));

  const secureMapUrl = raw.replace(/^http:\/\//i, "https://");

  if (hasGenericMapKeyword || normalized.endsWith(".gif")) {
    return [artistPhoto, secureMapUrl, "/hero.png"].filter(Boolean);
  }

  return [secureMapUrl, artistPhoto, "/hero.png"].filter(Boolean);
}

function normalizeCity(raw: string) {
  let city = (raw || "").trim().replace(/\+/g, " ");
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(city);
      if (decoded === city) break;
      city = decoded;
    } catch {
      break;
    }
  }
  return city;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ city?: string }> | { city?: string };
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const queryCity = normalizeCity(resolvedSearchParams?.city || "");

  const requestHeaders = await headers();
  const rawDetectedCity = (requestHeaders.get("x-vercel-ip-city") || "").trim();
  const detectedCity = normalizeCity(rawDetectedCity);
  const activeCity = queryCity || detectedCity;
  const requestHost = requestHeaders.get("host") || "";
  const requestProto =
    requestHeaders.get("x-forwarded-proto") ||
    (requestHost.includes("localhost") ? "http" : "https");
  const currentOrigin = requestHost
    ? `${requestProto}://${requestHost}`
    : baseUrl;

  async function fetchEventList(url: string) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return { events: [] as EventItem[], ok: false };
      const data = await response.json();
      return {
        events: (data?.result ?? data?.events ?? []) as EventItem[],
        ok: true,
      };
    } catch {
      return { events: [] as EventItem[], ok: false };
    }
  }

  const localizedApiUrl = activeCity
    ? `${currentOrigin}/api/events?numberOfEvents=8&city=${encodeURIComponent(activeCity)}&cityScope=city&diversify=1`
    : "";

  const localizedFetch = localizedApiUrl
    ? await fetchEventList(localizedApiUrl)
    : { events: [] as EventItem[], ok: true };
  const localizedEvents = localizedFetch.events;

  const fallbackFetch =
    localizedEvents.length === 0
      ? await fetchEventList(
          `${currentOrigin}/api/events?numberOfEvents=8&diversify=1`,
        )
      : { events: [] as EventItem[], ok: true };
  const fallbackEvents = fallbackFetch.events;

  const eventsToShow =
    localizedEvents.length > 0 ? localizedEvents : fallbackEvents;

  const hadApiError =
    localizedEvents.length === 0 && fallbackEvents.length === 0
      ? !localizedFetch.ok && !fallbackFetch.ok
      : false;
  const hasLocalEvents = localizedEvents.length > 0;
  const hasPopularFallback =
    localizedEvents.length === 0 && fallbackEvents.length > 0;
  const locationText = activeCity || "your area";

  return (
    <main style={styles.page}>
      {/* Global header */}

      {/* Hero */}
      <section style={styles.hero}>
        <img src="/hero.png" alt="TicketsBuzz hero" style={styles.heroImg} />

        <div style={styles.heroOverlay}>
          <h1 style={styles.heroTitle}>GREAT EVENTS AT SMALL PRICES</h1>

          <HeroSearch />

          <div style={styles.heroCtas}>
            {/* <Link href="/events" style={styles.ctaSecondary}>
              Browse all events
            </Link> */}
            <Link href="/events/2" style={styles.ctaSecondary}>
              Browse concerts
            </Link>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Events in {locationText}</h2>
        <AutoGeoCity hasCity={Boolean(activeCity)} />

        <div style={styles.locationRow}>
          <form action="/" method="GET" style={styles.locationForm}>
            <label htmlFor="city" style={styles.locationLabel}>
              Location
            </label>
            <input
              id="city"
              name="city"
              defaultValue={activeCity}
              placeholder="Change city"
              style={styles.locationInput}
              autoComplete="address-level2"
            />
            <button type="submit" style={styles.locationButton}>
              Update
            </button>
          </form>
          <span style={styles.locationBadge}>You are in: {locationText}</span>
          {!hasLocalEvents && !hasPopularFallback ? (
            <span style={styles.locationHint}>
              No direct local matches, showing popular events.
            </span>
          ) : null}
          {!hasLocalEvents && hasPopularFallback ? (
            <span style={styles.locationHint}>
              Showing popular events right now.
            </span>
          ) : null}
        </div>

        {eventsToShow.length === 0 ? (
          <p style={styles.emptyText}>
            {hadApiError
              ? "Events are temporarily unavailable. Please refresh in a moment."
              : "No events available right now."}
          </p>
        ) : (
          <>
            <div
              id="home-geo-carousel"
              className="tb-geo-grid"
              style={styles.localGrid}
            >
              {eventsToShow.slice(0, 6).map((event) => {
                const imageSources = resolveEventImageCandidates(event);
                return (
                  <Link
                    key={event.ID}
                    href={`/event/${event.ID}`}
                    className="tb-geo-card"
                    style={styles.localCard}
                  >
                    <EventCardImage
                      sources={imageSources}
                      alt={event.Name || "Event image"}
                      className="tb-geo-image"
                      style={styles.localImage}
                    />
                    <div style={styles.localTitle}>
                      {event.Name || "Untitled event"}
                    </div>
                    <div style={styles.localMeta}>
                      {event.City || ""}
                      {event.City && event.Venue ? " • " : ""}
                      {event.Venue || ""}
                    </div>
                    <div style={styles.localDate}>
                      {formatEventDate(event.DisplayDate)}
                    </div>
                  </Link>
                );
              })}
            </div>
            <GeoCarouselIndicators
              containerId="home-geo-carousel"
              itemCount={Math.min(eventsToShow.length, 6)}
            />
          </>
        )}
      </section>

      {/* Categories */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Browse by Category</h2>

        {/* ✅ Transition + hover comes from globals.css (see note below) */}
        <div style={styles.grid}>
          <Link href="/events/2" className="tb-card" style={styles.card}>
            <h3 style={styles.cardTitle}>🎵 Music</h3>
            <p style={styles.cardText}>Concerts & tours</p>
          </Link>

          <Link href="/events/1" className="tb-card" style={styles.card}>
            <h3 style={styles.cardTitle}>🏀 Sports</h3>
            <p style={styles.cardText}>Games & matches</p>
          </Link>

          <Link href="/events/3" className="tb-card" style={styles.card}>
            <h3 style={styles.cardTitle}>🎭 Theatre</h3>
            <p style={styles.cardText}>Shows & performances</p>
          </Link>

          {/* <Link href="/events" className="tb-card" style={styles.card}>
            <h3 style={styles.cardTitle}>⭐ All Events</h3>
            <p style={styles.cardText}>Browse everything</p>
          </Link> */}
        </div>
      </section>

      {/* Footer con enlace a Policy al final */}
      <footer style={styles.footer}>
        <a href="/policy" style={styles.footerButton}>
          Policy / Terms & Conditions
        </a>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    width: "100%",
    padding: "32px 0 24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0b0f24",
    marginTop: 40,
  },
  footerButton: {
    color: "#fff",
    background: "#29CE9F",
    border: "none",
    borderRadius: 999,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "background 0.18s",
    cursor: "pointer",
  },
  page: {
    fontFamily: "Arial",
    margin: 0,
  },

  hero: {
    position: "relative",
    height: 420,
    overflow: "hidden",
    background: "#0b0f24",
  },

  heroImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "brightness(0.75)",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    paddingBottom: 50,
    alignItems: "center",
    padding: 18,
    textAlign: "center",
  },

  heroTitle: {
    color: "#fff",
    fontSize: 34,
    letterSpacing: 1,
    margin: "6px 0 16px",
    textShadow: "0 2px 16px rgba(0,0,0,0.6)",
  },

  heroCtas: {
    marginTop: 14,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  ctaSecondary: {
    color: "#fff",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(0,0,0,0.15)",
    fontSize: 13,
    fontWeight: 700,
  },

  section: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "36px 18px 60px",
  },

  sectionTitle: {
    margin: "0 0 18px",
    fontSize: 22,
  },

  locationRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  locationForm: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  locationLabel: {
    fontSize: 13,
    color: "#333",
    fontWeight: 700,
  },
  locationInput: {
    border: "1px solid #c6c9d4",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 14,
    minWidth: 170,
    maxWidth: 220,
    background: "#fff",
  },
  locationButton: {
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 700,
    background: "#1f2a5a",
    color: "#fff",
    cursor: "pointer",
  },
  locationBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(31,42,90,0.1)",
    border: "1px solid rgba(31,42,90,0.25)",
    fontSize: 13,
    fontWeight: 700,
    color: "#1f2a5a",
  },
  locationHint: {
    fontSize: 13,
    color: "#666",
  },
  emptyText: {
    margin: 0,
    color: "#666",
  },

  localGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  localCard: {
    display: "block",
    textDecoration: "none",
    color: "#111",
    padding: 14,
    borderRadius: 16,
    border: "1px solid #cfd5de",
    background: "#eef1f5",
    boxShadow: "0 1px 0 rgba(0, 0, 0, 0.06)",
  },
  localImage: {
    width: "100%",
    height: 172,
    objectFit: "cover",
    borderRadius: 12,
    border: "1px solid #eceff4",
    background: "#f3f4f6",
    marginBottom: 12,
  },
  localTitle: {
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.3,
  },
  localMeta: {
    marginTop: 6,
    color: "#5b6472",
    fontSize: 13,
  },
  localDate: {
    marginTop: 6,
    color: "#6c7482",
    fontSize: 13,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },

  card: {
    display: "block",
    padding: 20,
    borderRadius: 14,
    background: "linear-gradient(145deg, #0a0a0a, #141414)",
    color: "#fff",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
  },

  cardText: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.75)",
  },
};
