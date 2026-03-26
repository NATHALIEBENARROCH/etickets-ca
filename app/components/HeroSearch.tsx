"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SuggestionItem = {
  ID?: string | number;
  Name?: string;
  City?: string;
  Venue?: string;
};

export default function HeroSearch({ dateFrom: initialDateFrom = "" }: { dateFrom?: string }) {
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
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
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=6`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) return;

        const payload = (await response.json()) as {
          result?: SuggestionItem[];
        };

        if (!isCancelled) {
          setSuggestions(payload.result ?? []);
          setIsOpen(true);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }, 220);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  return (
    <div style={styles.wrapper}>
      <form action="/search" style={styles.form}>
        <input
          name="q"
          required
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          autoFocus
          placeholder="Search for events, artists, teams or venues"
          style={styles.input}
          autoComplete="off"
        />
        <input
          name="dateFrom"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label="Event date"
          style={styles.cityInput}
        />
        <button type="submit" style={styles.button}>
          Search
        </button>
      </form>

      {isOpen && trimmedQuery.length >= 2 ? (
        <div style={styles.suggestBox}>
          {isLoading ? (
            <div style={styles.suggestMuted}>Searching...</div>
          ) : suggestions.length === 0 ? (
            <div style={styles.suggestMuted}>
              No quick matches. Press search for full results.
            </div>
          ) : (
            suggestions.map((event, index) => {
              const title = event.Name || "Untitled event";
              const meta = [event.City, event.Venue]
                .filter(Boolean)
                .join(" • ");
              const eventId = event.ID || index;

              return (
                <Link
                  key={`${eventId}-${index}`}
                  href={`/event/${eventId}`}
                  style={styles.suggestItem}
                >
                  <div style={styles.suggestTitle}>{title}</div>
                  <div style={styles.suggestMeta}>{meta}</div>
                </Link>
              );
            })
          )}

          <Link
            href={`/search?${new URLSearchParams({
              q: trimmedQuery,
              ...(dateFrom ? { dateFrom } : {}),
            }).toString()}`}
            style={styles.suggestSeeAll}
          >
            View all results for &quot;{trimmedQuery}&quot;
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    width: "min(920px, 92vw)",
    marginTop: 14,
    zIndex: 30,
  },
  form: {
    display: "flex",
    gap: 10,
    width: "100%",
  },
  input: {
    flex: 1,
    padding: "14px 16px",
    fontSize: 16,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.96)",
    outline: "none",
    color: "#111",
    boxShadow: "inset 0 3px 8px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.08)",
  },
  cityInput: {
    width: 180,
    padding: "14px 16px",
    fontSize: 15,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.96)",
    outline: "none",
    color: "#111",
    boxShadow: "inset 0 3px 8px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.08)",
  },
  button: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "2px solid #29CE9F",
    background: "#07110f",
    color: "#ffffff",
    fontWeight: 800,
    letterSpacing: "0.4px",
    cursor: "pointer",
    minWidth: 120,

    boxShadow: `
    inset 0 0 8px rgba(41,206,159,0.25),
    0 0 6px #29CE9F,
    0 0 16px rgba(41,206,159,0.9),
    0 0 34px rgba(41,206,159,0.7),
    0 0 70px rgba(41,206,159,0.45)
  `,

    textShadow: `
    0 0 2px #ffffff,
    0 0 6px #29CE9F,
    0 0 14px rgba(41,206,159,0.8)
  `,
  },
  suggestBox: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    background: "#fff",
    color: "#111",
    borderRadius: 14,
    border: "1px solid rgba(17,17,17,0.1)",
    boxShadow: "0 14px 32px rgba(0,0,0,0.18)",
    overflowY: "auto",
    maxHeight: 320,
    zIndex: 60,
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
};
