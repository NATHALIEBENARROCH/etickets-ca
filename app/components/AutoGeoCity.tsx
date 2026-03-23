"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AutoGeoCityProps = {
  hasCity: boolean;
};

export default function AutoGeoCity({ hasCity }: AutoGeoCityProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "detecting" | "denied" | "unsupported" | "insecure" | "error">("idle");
  const requestedRef = useRef(false);

  const applyCity = useCallback((rawCity: string) => {
    const city = String(rawCity || "").trim();
    if (!city) return false;

    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("city", city);
    const targetPath = pathname || "/";
    router.replace(`${targetPath}?${params.toString()}`, { scroll: false });
    return true;
  }, [pathname, router, searchParams]);

  const detectCityByIp = useCallback(async () => {
    try {
      const response = await fetch("/api/location/city", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return false;

      const payload = await response.json();
      const city = String(payload?.city || payload?.region || "").trim();
      return applyCity(city);
    } catch {
      return false;
    }
  }, [applyCity]);

  const requestLocation = useCallback(() => {
    if (hasCity) return;

    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      setStatus("insecure");
      void detectCityByIp();
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      void detectCityByIp();
      return;
    }

    setStatus("detecting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: { Accept: "application/json" },
            },
          );

          if (!response.ok) {
            setStatus("error");
            return;
          }

          const payload = await response.json();
          const city = (
            payload?.address?.city ||
            payload?.address?.town ||
            payload?.address?.village ||
            payload?.address?.municipality ||
            payload?.address?.state ||
            ""
          ).trim();

          if (!city) {
            setStatus("error");
            void detectCityByIp();
            return;
          }

          applyCity(city);
        } catch {
          setStatus("error");
          void detectCityByIp();
        }
      },
      () => {
        setStatus("denied");
        void detectCityByIp();
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      },
    );
  }, [applyCity, detectCityByIp, hasCity]);

  useEffect(() => {
    if (hasCity) return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    const timerId = window.setTimeout(() => {
      requestLocation();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [hasCity, requestLocation]);

  if (hasCity) return null;

  if (status === "detecting") {
    return <p style={styles.info}>Detecting your location...</p>;
  }

  if (status === "denied") {
    return (
      <div style={styles.row}>
        <p style={styles.warn}>Location access was denied. Showing general events.</p>
        <button style={styles.retryBtn} onClick={requestLocation} type="button">
          Try location again
        </button>
      </div>
    );
  }

  if (status === "insecure") {
    return (
      <div style={styles.row}>
        <p style={styles.warn}>On mobile, location needs HTTPS. Open this app with a secure URL to enable auto location.</p>
        <button style={styles.retryBtn} onClick={requestLocation} type="button">
          Retry location
        </button>
      </div>
    );
  }

  if (status === "unsupported" || status === "error") {
    return (
      <div style={styles.row}>
        <p style={styles.warn}>Could not detect location automatically. Showing general events.</p>
        <button style={styles.retryBtn} onClick={requestLocation} type="button">
          Retry location
        </button>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  info: {
    margin: "0 0 10px",
    fontSize: 13,
    color: "#334155",
    fontWeight: 600,
  },
  warn: {
    margin: "0 0 10px",
    fontSize: 13,
    color: "#666",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  retryBtn: {
    border: "1px solid rgba(31,42,90,0.28)",
    borderRadius: 999,
    background: "#fff",
    color: "#1f2a5a",
    fontWeight: 700,
    fontSize: 12,
    padding: "6px 10px",
    cursor: "pointer",
  },
};
