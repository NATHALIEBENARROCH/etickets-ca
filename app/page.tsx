import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import HeroSearch from "@/app/components/HeroSearch";
import AutoGeoCity from "@/app/components/AutoGeoCity";
import EventCardImage from "@/app/components/EventCardImage";
import GeoCarouselIndicators from "@/app/components/GeoCarouselIndicators";
import { resolveEventImageCandidates } from "@/lib/eventImages";

type EventItem = {
  ID: number;
  Name?: string;
  City?: string;
  Venue?: string;
  DisplayDate?: string;
  MapURL?: string;
};

const POPULAR_SEARCH_TERMS = [
  "bruno mars",
  "lady gaga",
  "coldplay",
  "taylor swift",
  "miami heat",
  "montreal canadiens",
];

const NEARBY_CITY_CANDIDATES: Record<string, string[]> = {
  laval: ["Montreal", "Longueuil", "Brossard", "Laval"],
  montreal: ["Laval", "Longueuil", "Brossard", "Laval"],
  longueuil: ["Montreal", "Laval", "Brossard", "Quebec"],
  brossard: ["Montreal", "Longueuil", "Laval", "Quebec"],
  quebec: ["Levis", "Montreal", "Trois-Rivieres", "Sherbrooke"],
  toronto: ["Mississauga", "North York", "Scarborough", "Hamilton"],
  mississauga: ["Toronto", "North York", "Scarborough", "Hamilton"],
  vancouver: ["Burnaby", "Richmond", "Surrey", "Victoria"],
  burnaby: ["Vancouver", "Richmond", "Surrey", "Victoria"],
  calgary: ["Airdrie", "Edmonton", "Red Deer", "Lethbridge"],
  edmonton: ["St. Albert", "Calgary", "Red Deer", "Leduc"],
  ottawa: ["Gatineau", "Montreal", "Kingston", "Cornwall"],
};

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
  city = city
    .replace(/\s*\((administrative\s+region|region\s+administrative)\)\s*$/i, "")
    .trim();
  return city;
}

function normalizeToken(value: string | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNearbyCityCandidates(city: string) {
  const normalizedCity = normalizeToken(city);
  if (!normalizedCity) return [];

  const canonical = NEARBY_CITY_CANDIDATES[normalizedCity] || [];
  return canonical.filter((candidate) => normalizeToken(candidate) !== normalizedCity);
}

function hasExactCityMatch(events: EventItem[], city: string) {
  const normalizedCity = normalizeToken(city);
  if (!normalizedCity) return events.length > 0;
  return events.some((event) => normalizeToken(event?.City) === normalizedCity);
}

function uniqueByEventId(events: EventItem[]) {
  const seen = new Set<number>();
  const unique: EventItem[] = [];

  for (const event of events) {
    if (!event?.ID || seen.has(event.ID)) continue;
    seen.add(event.ID);
    unique.push(event);
  }

  return unique;
}

function toEventTimestamp(event: EventItem) {
  const rawDate = event?.DisplayDate;
  if (!rawDate) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(rawDate);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function isTributeLikeName(name: string | undefined) {
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

function scorePopularEvent(event: EventItem, seedTerm: string) {
  const normalizedSeed = normalizeToken(seedTerm);
  const normalizedName = normalizeToken(event?.Name);
  if (!normalizedSeed || !normalizedName) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (normalizedName === normalizedSeed) score += 120;
  if (normalizedName.startsWith(normalizedSeed)) score += 80;
  if (normalizedName.includes(normalizedSeed)) score += 50;
  if (isTributeLikeName(event?.Name) && normalizedName !== normalizedSeed) score -= 35;
  score -= Math.min(toEventTimestamp(event), Number.MAX_SAFE_INTEGER) / 1e13;
  return score;
}

function interleavePopularEvents(groups: Array<{ term: string; events: EventItem[] }>, limit: number) {
  const merged: EventItem[] = [];
  const seen = new Set<number>();
  let currentIndex = 0;

  while (merged.length < limit) {
    let addedInRound = false;

    for (const group of groups) {
      const event = group.events[currentIndex];
      if (!event?.ID || seen.has(event.ID)) continue;
      seen.add(event.ID);
      merged.push(event);
      addedInRound = true;

      if (merged.length >= limit) break;
    }

    if (!addedInRound) break;
    currentIndex += 1;
  }

  return merged;
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

  async function fetchSearchList(query: string) {
    try {
      const response = await fetch(
        `${currentOrigin}/api/search?q=${encodeURIComponent(query)}&limit=6`,
        { cache: "no-store" },
      );
      if (!response.ok) return { events: [] as EventItem[], ok: false };
      const data = await response.json();
      return {
        events: (data?.result ?? []) as EventItem[],
        ok: true,
      };
    } catch {
      return { events: [] as EventItem[], ok: false };
    }
  }

  async function fetchPopularFallback() {
    const seededResults = await Promise.all(
      POPULAR_SEARCH_TERMS.map(async (term) => {
        const response = await fetchSearchList(term);
        const rankedEvents = uniqueByEventId(response.events)
          .map((event) => ({
            event,
            score: scorePopularEvent(event, term),
          }))
          .sort((firstEvent, secondEvent) => secondEvent.score - firstEvent.score)
          .map((item) => item.event)
          .slice(0, 4);

        return {
          term,
          events: rankedEvents,
          ok: response.ok,
        };
      }),
    );

    return {
      events: interleavePopularEvents(seededResults, 8),
      ok: seededResults.some((item) => item.ok),
    };
  }

  const localizedApiUrl = activeCity
    ? `${currentOrigin}/api/events?numberOfEvents=8&city=${encodeURIComponent(activeCity)}&cityScope=city&diversify=1`
    : "";

  const localizedFetch = localizedApiUrl
    ? await fetchEventList(localizedApiUrl)
    : { events: [] as EventItem[], ok: true };
  const localizedEvents = localizedFetch.events;
  const hasExactLocalMatch = hasExactCityMatch(localizedEvents, activeCity);

  let nearbyCityUsed = "";
  let nearbyEvents: EventItem[] = [];
  let nearbyOk = true;

  if (activeCity && !hasExactLocalMatch) {
    const nearbyCandidates = getNearbyCityCandidates(activeCity);
    for (const nearbyCity of nearbyCandidates) {
      const nearbyFetch = await fetchEventList(
        `${currentOrigin}/api/events?numberOfEvents=8&city=${encodeURIComponent(nearbyCity)}&cityScope=city&diversify=1`,
      );

      nearbyOk = nearbyOk && nearbyFetch.ok;

      if (nearbyFetch.events.length > 0 && hasExactCityMatch(nearbyFetch.events, nearbyCity)) {
        nearbyCityUsed = nearbyCity;
        nearbyEvents = nearbyFetch.events;
        break;
      }
    }
  }

  const curatedPopularFetch =
    localizedEvents.length === 0 && nearbyEvents.length === 0
      ? await fetchPopularFallback()
      : { events: [] as EventItem[], ok: true };
  const backupFallbackFetch =
    localizedEvents.length === 0 && nearbyEvents.length === 0 && curatedPopularFetch.events.length === 0
      ? await fetchEventList(
          `${currentOrigin}/api/events?numberOfEvents=8&parentCategoryID=2&diversify=1`,
        )
      : { events: [] as EventItem[], ok: true };
  const fallbackEvents =
    curatedPopularFetch.events.length > 0
      ? curatedPopularFetch.events
      : backupFallbackFetch.events;

  const eventsToShow = hasExactLocalMatch
    ? localizedEvents
    : (nearbyEvents.length > 0 ? nearbyEvents : fallbackEvents);

  const hadApiError =
    localizedEvents.length === 0 && nearbyEvents.length === 0 && fallbackEvents.length === 0
      ? !localizedFetch.ok && !nearbyOk && !curatedPopularFetch.ok && !backupFallbackFetch.ok
      : false;
  const hasLocalEvents = hasExactLocalMatch;
  const hasNearbyEvents = !hasLocalEvents && nearbyEvents.length > 0;
  const hasPopularFallback =
    !hasLocalEvents && !hasNearbyEvents && fallbackEvents.length > 0;
  const locationText = activeCity || "your area";
  const sectionHeading = hasLocalEvents
    ? `Events in ${locationText}`
    : (hasNearbyEvents
      ? `Events near ${locationText}`
      : "Popular events right now");

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
        <h2 style={styles.sectionTitle}>{sectionHeading}</h2>
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
              Looking for nearby events.
            </span>
          ) : null}
          {!hasLocalEvents && hasNearbyEvents ? (
            <span style={styles.locationHint}>
              No direct matches in {locationText}. Showing events in {nearbyCityUsed}.
            </span>
          ) : null}
          {!hasLocalEvents && hasPopularFallback ? (
            <span style={styles.locationHint}>
              {activeCity
                ? `No direct matches in ${locationText}. Showing popular events right now.`
                : "Showing popular events right now."}
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
    background: "#000000",
    marginTop: 40,
    boxShadow: "0 -20px 40px rgba(0,0,0,0.35), 0 -8px 16px rgba(0,0,0,0.2)",
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
    overflow: "visible",
    background: "#0b0f24",
    boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
    zIndex: 2,
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
    zIndex: 3,
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
    boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
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
    boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
    boxShadow: "0 3px 8px rgba(0,0,0,0.12)",
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
    border: "1px solid #d9dee7",
    background: "#f4f6fa",
    boxShadow: "12px 12px 30px rgba(60,60,60,0.45)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
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
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
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
