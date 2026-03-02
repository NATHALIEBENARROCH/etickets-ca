import Link from "next/link";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";

type EventItem = {
  id?: string | number;
  ID?: string | number;
  name?: string;
  Name?: string;
  eventName?: string;
  venueName?: string;
  Venue?: string;
  city?: string;
  City?: string;
  date?: string;
  DisplayDate?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }> | { q?: string };
}) {
  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams?.q ?? "").trim();
  let events: EventItem[] = [];
  let errorMsg = "";
  let correctedQuery = "";
  let fallbackStrategy = "";

  try {
    if (q) {
      const res = await fetch(
        `${baseUrl}/api/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        errorMsg = `Couldn’t load events (HTTP ${res.status}).`;
      } else {
        const data = (await res.json()) as {
          result?: EventItem[];
          events?: EventItem[];
          correctedQuery?: string | null;
          fallbackStrategy?: string | null;
        };
        events = data.result ?? data.events ?? [];
        correctedQuery = (data.correctedQuery ?? "").trim();
        fallbackStrategy = (data.fallbackStrategy ?? "").trim();
      }
    }
  } catch (e) {
    errorMsg = "Couldn’t load events (network/server error).";
  }

  return (
    <main style={styles.page}>
      <div style={styles.topRow}>
        <Link href="/" style={styles.backLink}>
          ← Back home
        </Link>
      </div>

      <h1 style={styles.h1}>Search results</h1>

      <p style={styles.meta}>
        Query: <b>{q || "(empty)"}</b> — Results: <b>{q ? events.length : 0}</b>
      </p>

      {!!correctedQuery && correctedQuery.toLowerCase() !== q.toLowerCase() && (
        <div style={{ ...styles.panel, ...styles.panelInfo }}>
          <div style={styles.panelTitle}>Showing results for "{correctedQuery}"</div>
          <div style={styles.panelText}>
            We interpreted your search using <b>{fallbackStrategy || "smart matching"}</b>.
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href={`/search?q=${encodeURIComponent(q)}`} style={styles.panelLink}>
              Retry exact search for "{q}"
            </Link>
          </div>
        </div>
      )}

      {!q && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Type something to search</div>
          <div style={styles.panelText}>
            Example: <span style={styles.code}>Lady Gaga</span>
          </div>
        </div>
      )}

      {!!errorMsg && (
        <div style={{ ...styles.panel, ...styles.panelError }}>
          <div style={styles.panelTitle}>Oops</div>
          <div style={styles.panelText}>{errorMsg}</div>
          <div style={{ marginTop: 10, opacity: 0.85 }}>
            Tip: confirm <b>NEXT_PUBLIC_SITE_URL</b> is set correctly in{" "}
            <span style={styles.code}>.env.local</span>
          </div>
        </div>
      )}

      {q && !errorMsg && (
        <div style={styles.grid}>
          {events.map((e, idx) => {
            const title = e.Name ?? e.name ?? e.eventName ?? "Untitled event";
            const venue = e.Venue ?? e.venueName ?? "";
            const city = e.City ?? e.city ?? "";
            const date = formatEventDate(e.DisplayDate ?? e.date);
            const id = e.ID ?? e.id ?? idx;

            return (
              <div key={String(id)} style={styles.card}>
                <div style={styles.cardTitle}>{title}</div>
                <div style={styles.cardMeta}>
                  {venue}
                  {venue && city ? " • " : ""}
                  {city}
                  {(venue || city) && date ? " • " : ""}
                  {date}
                </div>

                {id != null && (
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/event/${id}`} style={styles.cardLink}>
                      View event →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "linear-gradient(180deg, #0b0f24, #050714)",
    color: "#fff",
    fontFamily: "Arial",
  },
  topRow: {
    maxWidth: 1100,
    margin: "0 auto 10px",
  },
  backLink: {
    color: "rgba(255,255,255,0.9)",
    textDecoration: "none",
    fontWeight: 700,
  },
  h1: {
    maxWidth: 1100,
    margin: "0 auto 8px",
    fontSize: 28,
  },
  meta: {
    maxWidth: 1100,
    margin: "0 auto 18px",
    opacity: 0.8,
  },
  grid: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    background:
      "linear-gradient(180deg, rgba(31,42,90,0.95), rgba(11,15,36,0.95))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  cardTitle: { fontWeight: 900, fontSize: 16 },
  cardMeta: { marginTop: 6, opacity: 0.78, fontSize: 13, lineHeight: 1.35 },
  cardLink: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.25)",
    padding: "8px 10px",
    borderRadius: 999,
    display: "inline-block",
    background: "rgba(0,0,0,0.15)",
  },
  panel: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  panelError: {
    border: "1px solid rgba(255,90,90,0.35)",
    background: "rgba(255,90,90,0.08)",
  },
  panelInfo: {
    border: "1px solid rgba(116, 188, 255, 0.45)",
    background: "rgba(116, 188, 255, 0.10)",
    marginBottom: 14,
  },
  panelTitle: { fontWeight: 900, marginBottom: 6 },
  panelText: { opacity: 0.85 },
  panelLink: {
    color: "#cde9ff",
    textDecoration: "underline",
    fontWeight: 700,
  },
  code: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    background: "rgba(0,0,0,0.25)",
    padding: "2px 8px",
    borderRadius: 8,
  },
};
