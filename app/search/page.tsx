import Link from "next/link";
import { headers } from "next/headers";
import { baseUrl } from "@/lib/api";
import { formatEventDate } from "@/lib/dateFormat";
import EventCardImage from "@/app/components/EventCardImage";
import { resolveEventImageCandidates } from "@/lib/eventImages";

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
  MapURL?: string;
};

const PAGE_STEP = 50;
const MAX_LIMIT = 200;

function buildSearchHref(query: string, options: { city?: string; limit: number }) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(options.limit));

  if (options.city) {
    params.set("city", options.city);
  }

  return `/search?${params.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; limit?: string }> | { q?: string; city?: string; limit?: string };
}) {
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("host") || "";
  const requestProto = requestHeaders.get("x-forwarded-proto") || (requestHost.includes("localhost") ? "http" : "https");
  const currentOrigin = requestHost ? `${requestProto}://${requestHost}` : baseUrl;

  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams?.q ?? "").trim();
  const city = (resolvedSearchParams?.city ?? "").trim();
  const rawLimit = Number.parseInt(resolvedSearchParams?.limit || `${PAGE_STEP}`, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : PAGE_STEP;
  let events: EventItem[] = [];
  let errorMsg = "";
  let correctedQuery = "";
  let fallbackStrategy = "";
  let totalCount = 0;

  try {
    if (q) {
      const res = await fetch(
        `${currentOrigin}/api/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}&limit=${limit}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        errorMsg = `Couldn’t load events (HTTP ${res.status}).`;
      } else {
        const data = (await res.json()) as {
          result?: EventItem[];
          events?: EventItem[];
          count?: number;
          visibleCount?: number;
          correctedQuery?: string | null;
          fallbackStrategy?: string | null;
        };
        events = data.result ?? data.events ?? [];
        totalCount = Number.isFinite(data.count) ? Number(data.count) : events.length;
        correctedQuery = (data.correctedQuery ?? "").trim();
        fallbackStrategy = (data.fallbackStrategy ?? "").trim();
      }
    }
  } catch {
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
        Query: <b>{q || "(empty)"}</b>
        {city ? <> — City: <b>{city}</b></> : null}
        {" — Results: "}<b>{q ? totalCount : 0}</b>
        {q && totalCount > events.length ? <> <span style={styles.metaSecondary}>(showing {events.length})</span></> : null}
      </p>

      {!!correctedQuery && correctedQuery.toLowerCase() !== q.toLowerCase() && (
        <div style={{ ...styles.panel, ...styles.panelInfo }}>
          <div style={styles.panelTitle}>Showing results for &quot;{correctedQuery}&quot;</div>
          <div style={styles.panelText}>
            We interpreted your search using <b>{fallbackStrategy || "smart matching"}</b>.
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href={`/search?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ""}`} style={styles.panelLink}>
              Retry exact search for &quot;{q}&quot;
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
        <div id="results" style={styles.resultsBlock}>
          <div style={styles.grid}>
            {events.map((e, idx) => {
              const title = e.Name ?? e.name ?? e.eventName ?? "Untitled event";
              const venue = e.Venue ?? e.venueName ?? "";
              const city = e.City ?? e.city ?? "";
              const date = formatEventDate(e.DisplayDate ?? e.date);
              const id = e.ID ?? e.id ?? idx;
              const imageSources = resolveEventImageCandidates(e);

              return (
                <div key={String(id)} style={styles.card}>
                  <EventCardImage
                    sources={imageSources}
                    alt={title}
                    style={styles.cardImage}
                  />
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
          <div style={styles.paginationRow}>
            {events.length >= limit && limit < MAX_LIMIT ? (
              <Link href={buildSearchHref(q, { city, limit: Math.min(limit + PAGE_STEP, MAX_LIMIT) })} style={styles.paginationLink} scroll={false}>
                Load more
              </Link>
            ) : null}

            {limit > PAGE_STEP ? (
              <Link href={buildSearchHref(q, { city, limit: PAGE_STEP })} style={styles.paginationLink} scroll={false}>
                Show less
              </Link>
            ) : null}
          </div>
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
  metaSecondary: {
    opacity: 0.8,
    fontSize: 14,
  },
  grid: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  resultsBlock: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  card: {
    padding: 16,
    borderRadius: 14,
    background:
      "linear-gradient(180deg, rgba(31,42,90,0.95), rgba(11,15,36,0.95))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  cardImage: {
    width: "100%",
    height: 150,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    marginBottom: 10,
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
  paginationRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  paginationLink: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.25)",
    padding: "8px 12px",
    borderRadius: 999,
    display: "inline-block",
    background: "rgba(0,0,0,0.15)",
  },
};
