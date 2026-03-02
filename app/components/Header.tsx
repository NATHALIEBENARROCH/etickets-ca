"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HeaderProps = {
  /** Optional: prefill the search box (ex: on /search page) */
  defaultQuery?: string;
  showSearch?: boolean;
};

export default function Header({ defaultQuery = "", showSearch = true }: HeaderProps) {
  const [q, setQ] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<Array<{ ID?: string | number; Name?: string; City?: string; Venue?: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const trimmedQuery = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    let isCancelled = false;

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=6`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = await response.json() as {
          result?: Array<{ ID?: string | number; Name?: string; City?: string; Venue?: string }>;
        };

        if (!isCancelled) {
          setSuggestions(payload.result ?? []);
          setIsOpen(true);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  // const cities = [
  //   "New York",
  //   "Los Angeles",
  //   "Boston",
  //   "Miami",
  //   "Houston",
  //   "San Francisco",
  //   "Chicago",
  //   "Las Vegas",
  // ];

  return (
    <header style={styles.header}>
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <Link href="/events/2" style={styles.navLink}>
            Concerts
          </Link>
          <Link href="/events/1" style={styles.navLink}>
            Sports
          </Link>
          <Link href="/events/3" style={styles.navLink}>
            Theater
          </Link>
        </div>

        <div style={styles.navCenter}>
          <Link href="/" aria-label="TicketsBuzz home" style={styles.logoLink}>
            <img src="/logo.png" alt="TicketsBuzz" style={styles.navLogo} />
          </Link>
        </div>

        <div style={styles.navRight}>
          {showSearch ? (
            <div style={styles.searchWrapper}>
              <form action="/search" style={styles.navSearch}>
                <input
                  name="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={() => setIsOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsOpen(false), 120);
                  }}
                  placeholder="Search for team or artist..."
                  style={styles.navSearchInput}
                  autoComplete="off"
                />
                <button
                  style={styles.navSearchBtn}
                  aria-label="Search"
                  type="submit"
                >
                  🔎
                </button>
              </form>

              {isOpen && trimmedQuery.length >= 2 ? (
                <div style={styles.suggestBox}>
                  {isLoading ? (
                    <div style={styles.suggestMuted}>Searching…</div>
                  ) : suggestions.length === 0 ? (
                    <div style={styles.suggestMuted}>No quick matches. Press search for full results.</div>
                  ) : (
                    suggestions.map((event, idx) => {
                      const title = event.Name || "Untitled event";
                      const meta = [event.City, event.Venue].filter(Boolean).join(" • ");
                      const eventId = event.ID || idx;

                      return (
                        <Link
                          key={`${eventId}-${idx}`}
                          href={`/event/${eventId}`}
                          style={styles.suggestItem}
                        >
                          <div style={styles.suggestTitle}>{title}</div>
                          <div style={styles.suggestMeta}>{meta}</div>
                        </Link>
                      );
                    })
                  )}

                  <Link href={`/search?q=${encodeURIComponent(trimmedQuery)}`} style={styles.suggestSeeAll}>
                    View all results for "{trimmedQuery}"
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      {/* <div style={styles.subnav}>
        {cities.map((c) => (
          <Link
            key={c}
            href={`/search?q=${encodeURIComponent(c)}`}
            style={styles.subnavLink}
          >
            {c}
          </Link>
        ))}
      </div> */}
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    background: "#1f2a5a",
    color: "#fff",
  },
  nav: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 16,
  },
  navLeft: { display: "flex", gap: 18, alignItems: "center" },
  navCenter: { display: "flex", justifyContent: "center" },
  navRight: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  searchWrapper: {
    position: "relative",
    width: 300,
  },

  navLink: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 15,
  },

  logoLink: { display: "inline-flex", alignItems: "center" },
  navLogo: {
    height: 52, // bigger logo in top nav
    width: "auto",
    objectFit: "contain",
    cursor: "pointer",
  },

  navSearch: { display: "flex", alignItems: "center", gap: 8 },
  navSearchInput: {
    padding: "8px 10px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    width: 240,
    outline: "none",
  },
  navSearchBtn: {
    border: "none",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },
  suggestBox: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: "100%",
    background: "#fff",
    color: "#111",
    borderRadius: 12,
    border: "1px solid rgba(17,17,17,0.1)",
    boxShadow: "0 14px 32px rgba(0,0,0,0.18)",
    overflow: "hidden",
    zIndex: 50,
  },
  suggestItem: {
    display: "block",
    padding: "10px 12px",
    textDecoration: "none",
    color: "#111",
    borderBottom: "1px solid #f1f1f1",
  },
  suggestTitle: {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.25,
  },
  suggestMeta: {
    marginTop: 2,
    color: "#666",
    fontSize: 12,
  },
  suggestMuted: {
    padding: "12px",
    color: "#666",
    fontSize: 13,
  },
  suggestSeeAll: {
    display: "block",
    padding: "10px 12px",
    textDecoration: "none",
    fontWeight: 700,
    color: "#1f2a5a",
    background: "#f8f9fc",
  },

  subnav: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "8px 18px 14px",
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    color: "rgba(255,255,255,0.85)",
  },
  subnavLink: {
    color: "rgba(255,255,255,0.85)",
    textDecoration: "none",
    fontSize: 13,
  },
};
