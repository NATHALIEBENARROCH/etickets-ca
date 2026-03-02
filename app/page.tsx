import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import HeroSearch from "@/app/components/HeroSearch";

type EventItem = {
  ID: number;
  Name?: string;
  City?: string;
  Venue?: string;
  DisplayDate?: string;
};

export default async function Home() {
  const requestHeaders = await headers();
  const rawDetectedCity = (requestHeaders.get("x-vercel-ip-city") || "").trim();
  let detectedCity = rawDetectedCity.replace(/\+/g, " ");
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(detectedCity);
      if (decoded === detectedCity) break;
      detectedCity = decoded;
    } catch {
      break;
    }
  }

  const localizedApiUrl = detectedCity
    ? `${baseUrl}/api/events?numberOfEvents=8&city=${encodeURIComponent(detectedCity)}`
    : `${baseUrl}/api/events?numberOfEvents=8`;

  let localizedEvents: EventItem[] = [];
  try {
    const localizedRes = await fetch(localizedApiUrl, { cache: "no-store" });
    if (localizedRes.ok) {
      const data = await localizedRes.json();
      localizedEvents = data?.result ?? [];
    }
  } catch {
    localizedEvents = [];
  }

  let fallbackEvents: EventItem[] = [];
  if (localizedEvents.length === 0) {
    try {
      const fallbackRes = await fetch(`${baseUrl}/api/events?numberOfEvents=8`, { cache: "no-store" });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        fallbackEvents = data?.result ?? [];
      }
    } catch {
      fallbackEvents = [];
    }
  }

  const eventsToShow = localizedEvents.length > 0 ? localizedEvents : fallbackEvents;
  const hasLocalEvents = localizedEvents.length > 0;
  const locationText = detectedCity || "your area";

  return (
    <main style={styles.page}>
      {/* Global header */}

      {/* Hero */}
      <section style={styles.hero}>
        <img src="/hero.png" alt="TicketsBuzz hero" style={styles.heroImg} />

        <div style={styles.heroOverlay}>
          <h1 style={styles.heroTitle}>GET YOUR TICKETSBUZZ HERE!</h1>

          <HeroSearch />

          <div style={styles.heroCtas}>
            <Link href="/events" style={styles.ctaSecondary}>
              Browse all events
            </Link>
            <Link href="/events/2" style={styles.ctaSecondary}>
              Browse concerts
            </Link>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Events by your location</h2>
        <div style={styles.locationRow}>
          <span style={styles.locationBadge}>Location: {locationText}</span>
          {!hasLocalEvents ? (
            <span style={styles.locationHint}>No direct local matches, showing popular events.</span>
          ) : null}
        </div>

        {eventsToShow.length === 0 ? (
          <p style={styles.emptyText}>No events available right now.</p>
        ) : (
          <div style={styles.localGrid}>
            {eventsToShow.slice(0, 6).map((event) => (
              <Link key={event.ID} href={`/event/${event.ID}`} style={styles.localCard}>
                <div style={styles.localTitle}>{event.Name || "Untitled event"}</div>
                <div style={styles.localMeta}>
                  {event.City || ""}
                  {event.City && event.Venue ? " • " : ""}
                  {event.Venue || ""}
                </div>
                <div style={styles.localDate}>{formatEventDate(event.DisplayDate)}</div>
              </Link>
            ))}
          </div>
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
            <h3 style={styles.cardTitle}>🎭 Theater</h3>
            <p style={styles.cardText}>Shows & performances</p>
          </Link>

          <Link href="/events" className="tb-card" style={styles.card}>
            <h3 style={styles.cardTitle}>⭐ All Events</h3>
            <p style={styles.cardText}>Browse everything</p>
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  localCard: {
    display: "block",
    textDecoration: "none",
    color: "#111",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  },
  localTitle: {
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.3,
  },
  localMeta: {
    marginTop: 6,
    color: "#555",
    fontSize: 13,
  },
  localDate: {
    marginTop: 6,
    color: "#666",
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
    background: "linear-gradient(180deg, #1f2a5a, #0b0f24)",
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
