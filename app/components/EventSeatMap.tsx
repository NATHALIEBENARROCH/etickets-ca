"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type EventSeatMapProps = {
  eventId: number;
  interactiveMapUrl?: string;
  ticketLink: string;
  wcid?: string;
  forceScriptMode?: boolean;
  checkoutConfig?: {
    c2CheckoutUrl?: string;
    useC3?: boolean;
    c3CheckoutDomain?: string;
    c3CurrencyCode?: string;
    c3UtmSource?: string;
    c3UtmMedium?: string;
    c3UtmCampaign?: string;
    c3UtmContent?: string;
    c3UtmTerm?: string;
    c3PromoCode?: string;
  };
};

type UnknownRenderer = ((config: Record<string, unknown>) => unknown) | undefined;

type SeaticsWindow = Window & {
  Seatics?: {
    config?: {
      buyButtonContentHtml?: string;
      skipPrecheckout?: boolean;
      skipPrecheckoutMobile?: boolean;
      skipPrecheckoutDesktop?: boolean;
      checkoutUrl?: string;
      useC3?: boolean;
      c3CheckoutDomain?: string;
      c3CurrencyCode?: string;
      c3UtmSource?: string;
      c3UtmMedium?: string;
      c3UtmCampaign?: string;
      c3UtmContent?: string;
      c3UtmTerm?: string;
      c3PromoCode?: string;
      mapFinishedRenderingHandler?: () => void;
      onBuyButtonClicked?: () => boolean;
    };
  };
};

function normalizeWidgetValue(value?: string) {
  return String(value || "")
    .replace(/\\r\\n/g, "")
    .replace(/\\n/g, "")
    .replace(/\\r/g, "")
    .replace(/[\r\n]+/g, "")
    .trim();
}

function resolveRenderer(): UnknownRenderer {
  const runtime = window as Window & {
    MapWidget3?: { render?: UnknownRenderer };
    TNMapWidget3?: { render?: UnknownRenderer };
    TNMapWidget?: { render?: UnknownRenderer };
    renderMapWidget3?: UnknownRenderer;
  };

  return (
    runtime.TNMapWidget3?.render ||
    runtime.MapWidget3?.render ||
    runtime.TNMapWidget?.render ||
    runtime.renderMapWidget3
  );
}

export default function EventSeatMap({
  eventId,
  interactiveMapUrl,
  ticketLink,
  wcid,
  forceScriptMode = false,
  checkoutConfig,
}: EventSeatMapProps) {
  const debugMapWidget = process.env.NEXT_PUBLIC_TN_DEBUG_MAPWIDGET === "true";
  const [widgetMounted, setWidgetMounted] = useState(false);
  const [widgetFailed, setWidgetFailed] = useState(false);
  const [forceHtmlMode, setForceHtmlMode] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [htmlAttempt, setHtmlAttempt] = useState(0);
  const [useDirectMapFallback, setUseDirectMapFallback] = useState(false);
  const [showExternalCheckout, setShowExternalCheckout] = useState(false);
  const [blockedCheckoutUrl, setBlockedCheckoutUrl] = useState<string | null>(null);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [scriptRetryKey, setScriptRetryKey] = useState(0);
  const [forceScriptFallback, setForceScriptFallback] = useState(false);
  const hasInitialized = useRef(false);
  const didPromoteCheckoutRef = useRef(false);
  const seaticsContainerRef = useRef<HTMLDivElement | null>(null);
  const htmlIframeRef = useRef<HTMLIFrameElement | null>(null);

  const widgetScriptUrl = process.env.NEXT_PUBLIC_TN_MAPWIDGET_SCRIPT_URL?.trim() || "";
  const widgetEnabled = process.env.NEXT_PUBLIC_TN_ENABLE_MAPWIDGET3 === "true" && Boolean(widgetScriptUrl);
  const bid = process.env.NEXT_PUBLIC_TN_BID?.trim() || "";
  const siteNumber = process.env.NEXT_PUBLIC_TN_SITE_NUMBER?.trim() || "";
  const ticketWidgetId = process.env.NEXT_PUBLIC_TN_TICKET_WIDGET_ID?.trim() || "ticket_results4";
  const useDarkTheme = process.env.NEXT_PUBLIC_TN_MAPWIDGET_USE_DARK_THEME === "true";
  const isSeaticsScriptMode = /seatics\.com\/(mobile\/js|js)/i.test(widgetScriptUrl);
  const scriptOnlyDiagnosticMode = false;
  const useInlineSeaticsLoader = isSeaticsScriptMode && !scriptOnlyDiagnosticMode;
  const normalizedWcid = useMemo(() => normalizeWidgetValue(wcid), [wcid]);
  const normalizedTicketLink = useMemo(() => normalizeWidgetValue(ticketLink), [ticketLink]);
  const normalizedInteractiveMapUrl = useMemo(() => normalizeWidgetValue(interactiveMapUrl), [interactiveMapUrl]);
  const canUseDirectMapFallback = useMemo(() => {
    if (!normalizedInteractiveMapUrl) return false;
    if (/\.swf(?:$|[?#])/i.test(normalizedInteractiveMapUrl)) return false;
    return /^https?:\/\//i.test(normalizedInteractiveMapUrl);
  }, [normalizedInteractiveMapUrl]);

  const containerId = useMemo(() => `tn-mapwidget-${eventId}`, [eventId]);

  const seaticsScriptSrc = useMemo(() => {
    if (!widgetScriptUrl) return "";
    const delimiter = widgetScriptUrl.includes("?") ? "&" : "?";
    const darkThemeParam = useDarkTheme ? "&useDarkTheme=true" : "";
    return `${widgetScriptUrl}${delimiter}eventId=${encodeURIComponent(String(eventId))}&websiteConfigId=${encodeURIComponent(normalizedWcid)}${darkThemeParam}`;
  }, [eventId, normalizedWcid, useDarkTheme, widgetScriptUrl]);

  const seaticsHtmlSrc = useMemo(() => {
    if (!normalizedWcid) return "";
    const base = `/api/mapwidget/html?eventId=${encodeURIComponent(String(eventId))}&websiteConfigId=${encodeURIComponent(normalizedWcid)}&userAgent=${encodeURIComponent("TicketsBuzz")}&forceMapOpen=true&ticketUrl=${encodeURIComponent(normalizedTicketLink)}`;
    return useDarkTheme ? `${base}&useDarkTheme=true` : base;
  }, [eventId, normalizedTicketLink, normalizedWcid, useDarkTheme]);

  const htmlIframeSrc = useMemo(() => {
    if (useDirectMapFallback && canUseDirectMapFallback) return normalizedInteractiveMapUrl;
    if (!seaticsHtmlSrc) return "";
    const joiner = seaticsHtmlSrc.includes("?") ? "&" : "?";
    return `${seaticsHtmlSrc}${joiner}_attempt=${htmlAttempt}`;
  }, [canUseDirectMapFallback, htmlAttempt, normalizedInteractiveMapUrl, seaticsHtmlSrc, useDirectMapFallback]);

  const mapShellStyle = {
    width: "100%",
    maxWidth: 980,
    minHeight: 900,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "block",
    margin: "0 auto",
    overflow: "hidden" as const,
  };

  const shouldUseHtmlMode =
    !scriptOnlyDiagnosticMode &&
    Boolean(seaticsHtmlSrc) &&
    (forceHtmlMode || isSeaticsScriptMode || !widgetEnabled) &&
    !forceScriptMode &&
    !forceScriptFallback;

  const shouldSwitchToScriptMode = (iframe: HTMLIFrameElement | null) => {
    if (!iframe) return false;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return false;
      const text = (doc.body?.textContent || "").replace(/\s+/g, " ").toLowerCase();
      if (!text) return false;

      return (
        text.includes("sorry, there are no results for this event") ||
        text.includes("there are no results for this event") ||
        text.includes("404 - file or directory not found") ||
        text.includes("resource you are looking for might have been removed")
      );
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!shouldUseHtmlMode) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; checkoutUrl?: string } | null;
      if (!data || typeof data !== "object") return;

      if (debugMapWidget && data.type?.startsWith("TN_EMBED_")) {
        console.info("[MapWidget debug] message", data.type, data.checkoutUrl || "");
      }

      if (data.type === "TN_EMBED_CHECKOUT_ATTEMPT") {
        const attemptUrl = typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("http")
          ? data.checkoutUrl
          : normalizedTicketLink;

        // If checkout attempt does not navigate top-level (blocked), expose fallback shortly after.
        window.setTimeout(() => {
          setBlockedCheckoutUrl(attemptUrl);
          setShowExternalCheckout(true);
        }, 1600);
        return;
      }

      if (data.type !== "TN_EMBED_CHECKOUT_BLOCKED") return;

      if (typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("http")) {
        setBlockedCheckoutUrl(data.checkoutUrl);
      }
      setShowExternalCheckout(true);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [debugMapWidget, normalizedTicketLink, shouldUseHtmlMode]);

  useEffect(() => {
    if (!shouldUseHtmlMode || iframeLoaded) return;

    const timer = window.setTimeout(() => {
      if (iframeLoaded) return;

      if (htmlAttempt < 1) {
        setHtmlAttempt((value) => value + 1);
        return;
      }

      if (!useDirectMapFallback && canUseDirectMapFallback) {
        setUseDirectMapFallback(true);
        return;
      }

      // Last resort: stop spinner so page doesn't look frozen.
      setIframeLoaded(true);
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canUseDirectMapFallback, htmlAttempt, iframeLoaded, shouldUseHtmlMode, useDirectMapFallback]);

  function hasRenderedMapContent(target: HTMLDivElement) {
    if (!target) return false;
    if (target.querySelector("iframe[src], canvas, svg, .seatics-root, .venue-ticket-list")) return true;

    if (
      target.querySelector(
        "[id*='sea-'], [class*='sea-'], .venueticket-list-checkout-trigger-js, a[href*='ticketnetwork'], button[class*='checkout']",
      )
    ) {
      return true;
    }

    const meaningfulText = (target.textContent || "").replace(/\s+/g, " ").trim();
    return meaningfulText.length > 80;
  }

  function renderFallback() {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#b00020", marginBottom: 10 }}>
          The interactive seat map is temporarily unavailable for this event.
        </p>
        <a
          href={normalizedTicketLink}
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
          Continue to tickets
        </a>
      </div>
    );
  }

  useEffect(() => {
    const useHtmlMode = shouldUseHtmlMode;
    if (!widgetEnabled || useHtmlMode || !useInlineSeaticsLoader || hasInitialized.current) return;
    const target = seaticsContainerRef.current;
    if (!target || !seaticsScriptSrc || !normalizedWcid) return;

    hasInitialized.current = true;
    didPromoteCheckoutRef.current = false;
    target.innerHTML = "";

    const runtime = window as SeaticsWindow;
    runtime.Seatics = runtime.Seatics || {};
    runtime.Seatics.config = runtime.Seatics.config || {};
    const runtimeHost = (window.location.hostname || "").toLowerCase();
    const isLocalRuntime = runtimeHost === "localhost" || runtimeHost === "127.0.0.1";
    const configuredCheckoutHost = (checkoutConfig?.c3CheckoutDomain || "").toLowerCase();
    const preferredCheckoutHost = configuredCheckoutHost || "";

    const normalizeCheckoutUrl = (value?: string | null) => {
      if (!value) return "";
      try {
        const parsed = new URL(value, window.location.href);
        const host = (parsed.hostname || "").toLowerCase();
        if (!preferredCheckoutHost || !host.startsWith("checkout.")) return parsed.toString();
        parsed.protocol = "https:";
        parsed.hostname = preferredCheckoutHost;
        parsed.port = "";
        return parsed.toString();
      } catch {
        return String(value);
      }
    };

    const isCheckoutLikeUrl = (value?: string | null) => {
      if (!value) return false;
      try {
        const parsed = new URL(value, window.location.href);
        const host = (parsed.hostname || "").toLowerCase();
        const path = (parsed.pathname || "").toLowerCase();

        if (configuredCheckoutHost && host === configuredCheckoutHost) return true;
        if (host.startsWith("checkout.")) return true;
        if (host.includes("ticketnetwork.com") && path.includes("checkout")) return true;

        return false;
      } catch {
        return false;
      }
    };

    const promoteCheckoutToTop = () => {
      if (didPromoteCheckoutRef.current) return;
      const candidates: string[] = [];

      document.querySelectorAll<HTMLFormElement>("form[action]").forEach((form) => {
        const action = form.getAttribute("action") || "";
        if (isCheckoutLikeUrl(action)) {
          const normalized = normalizeCheckoutUrl(action);
          if (normalized) form.setAttribute("action", normalized);
          form.setAttribute("target", "_top");
          candidates.push(normalized || action);
        }
      });

      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (isCheckoutLikeUrl(href)) {
          const normalized = normalizeCheckoutUrl(href);
          if (normalized) anchor.setAttribute("href", normalized);
          anchor.setAttribute("target", "_top");
          candidates.push(normalized || href);
        }
      });

      document.querySelectorAll<HTMLIFrameElement>("iframe[src]").forEach((iframe) => {
        const src = iframe.getAttribute("src") || "";
        if (isCheckoutLikeUrl(src)) {
          const normalized = normalizeCheckoutUrl(src);
          if (normalized) iframe.setAttribute("src", normalized);
          candidates.push(normalized || src);
        }
      });

      const first = candidates[0];
      if (!first) return;

      try {
        didPromoteCheckoutRef.current = true;
        const resolved = new URL(first, window.location.href).toString();
        if (window.top && window.top !== window) {
          window.top.location.href = resolved;
        } else {
          window.location.href = resolved;
        }
      } catch {
        didPromoteCheckoutRef.current = false;
        // Ignore malformed URLs and let native flow continue.
      }
    };

    const onSubmitCapture = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;

      const action = form.getAttribute("action") || "";
      if (!isCheckoutLikeUrl(action)) return;
      const normalized = normalizeCheckoutUrl(action);
      if (normalized) form.setAttribute("action", normalized);
      form.setAttribute("target", "_top");
    };

    const onClickCapture = (event: Event) => {
      const targetNode = event.target as HTMLElement | null;
      if (!targetNode) return;

      const anchor = targetNode.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (!isCheckoutLikeUrl(href)) return;
      const normalized = normalizeCheckoutUrl(href);
      if (normalized) anchor.setAttribute("href", normalized);
      anchor.setAttribute("target", "_top");
    };

    document.addEventListener("submit", onSubmitCapture, true);
    document.addEventListener("click", onClickCapture, true);

    runtime.Seatics.config.onBuyButtonClicked = () => {
      // Keep native checkout flow but make sure it escapes iframe context.
      window.setTimeout(() => {
        promoteCheckoutToTop();
      }, 0);
      return true;
    };

    runtime.Seatics.config.mapFinishedRenderingHandler = () => {
      if (!isActive) return;
      setWidgetMounted(true);
      setIsSlowLoading(false);
    };
    // Keep provider default CTA markup/behavior to avoid breaking internal checkout flow.
    runtime.Seatics.config.skipPrecheckout = false;
    runtime.Seatics.config.skipPrecheckoutMobile = false;
    runtime.Seatics.config.skipPrecheckoutDesktop = false;

    const hasC3 = Boolean(checkoutConfig?.useC3 && preferredCheckoutHost);
    if (hasC3) {
      runtime.Seatics.config.useC3 = true;
      runtime.Seatics.config.c3CheckoutDomain = preferredCheckoutHost;
      runtime.Seatics.config.c3CurrencyCode = checkoutConfig?.c3CurrencyCode || "USD";
      if (checkoutConfig?.c3UtmSource) runtime.Seatics.config.c3UtmSource = checkoutConfig.c3UtmSource;
      if (checkoutConfig?.c3UtmMedium) runtime.Seatics.config.c3UtmMedium = checkoutConfig.c3UtmMedium;
      if (checkoutConfig?.c3UtmCampaign) runtime.Seatics.config.c3UtmCampaign = checkoutConfig.c3UtmCampaign;
      if (checkoutConfig?.c3UtmContent) runtime.Seatics.config.c3UtmContent = checkoutConfig.c3UtmContent;
      if (checkoutConfig?.c3UtmTerm) runtime.Seatics.config.c3UtmTerm = checkoutConfig.c3UtmTerm;
      if (checkoutConfig?.c3PromoCode) runtime.Seatics.config.c3PromoCode = checkoutConfig.c3PromoCode;
    } else if (isLocalRuntime && checkoutConfig?.c2CheckoutUrl) {
      runtime.Seatics.config.checkoutUrl = checkoutConfig.c2CheckoutUrl;
    } else {
      runtime.Seatics.config.checkoutUrl = normalizedTicketLink;
      runtime.Seatics.config.useC3 = false;
    }

    const script = document.createElement("script");
    script.src = seaticsScriptSrc;
    script.async = true;
    let isActive = true;
    let verifyTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (!isActive) return;
      if (hasRenderedMapContent(target)) {
        setWidgetMounted(true);
        setIsSlowLoading(false);
      }

      // Provider injects checkout in an iframe/link/form; move to top-level before browser blocks iframe.
      const checkoutIframe = target.querySelector<HTMLIFrameElement>("iframe[src]");
      if (checkoutIframe) {
        const src = checkoutIframe.getAttribute("src") || "";
        if (isCheckoutLikeUrl(src)) {
          const normalized = normalizeCheckoutUrl(src);
          if (normalized) checkoutIframe.setAttribute("src", normalized);
          promoteCheckoutToTop();
          return;
        }
      }

      const checkoutAnchor = target.querySelector<HTMLAnchorElement>("a[href]");
      if (checkoutAnchor) {
        const href = checkoutAnchor.getAttribute("href") || "";
        if (isCheckoutLikeUrl(href)) {
          const normalized = normalizeCheckoutUrl(href);
          if (normalized) checkoutAnchor.setAttribute("href", normalized);
          checkoutAnchor.setAttribute("target", "_top");
        }
      }

      const checkoutForm = target.querySelector<HTMLFormElement>("form[action]");
      if (checkoutForm) {
        const action = checkoutForm.getAttribute("action") || "";
        if (isCheckoutLikeUrl(action)) {
          const normalized = normalizeCheckoutUrl(action);
          if (normalized) checkoutForm.setAttribute("action", normalized);
          checkoutForm.setAttribute("target", "_top");
        }
      }
    });

    // In script-only diagnostic mode we do not auto-switch rendering modes.
    const slowTimer = setTimeout(() => {
      if (!isActive) return;
      if (!hasRenderedMapContent(target)) {
        if (seaticsHtmlSrc) {
          hasInitialized.current = false;
          setForceHtmlMode(true);
          return;
        }

        setIsSlowLoading(true);
      }
    }, 1800);

    const hardFallbackTimer = setTimeout(() => {
      if (!isActive) return;
      if (hasRenderedMapContent(target)) return;

      target.innerHTML = "";
      setWidgetMounted(false);
      setIsSlowLoading(false);
      if (seaticsHtmlSrc) {
        hasInitialized.current = false;
        setForceHtmlMode(true);
      } else {
        setWidgetFailed(true);
      }
    }, 4200);

    script.onload = () => {
      observer.observe(target, { childList: true, subtree: true });

      verifyTimer = setTimeout(() => {
        if (!isActive) return;

        const text = (target.textContent || "").toLowerCase();
        const hasDeploymentError =
          text.includes("deployment_not_found") ||
          text.includes("deployment cannot be found") ||
          Array.from(target.querySelectorAll("iframe, script, a")).some((node) => {
            const value = (node.getAttribute("src") || node.getAttribute("href") || "").toLowerCase();
            return value.includes("deployment_not_found") || value.includes("deployment-cannot-be-found");
          });
        const hasContent = hasRenderedMapContent(target);

        if (hasDeploymentError || !hasContent) {
          target.innerHTML = "";
          setWidgetMounted(false);
          setIsSlowLoading(false);

          if (seaticsHtmlSrc) {
            hasInitialized.current = false;
            setForceHtmlMode(true);
          } else {
            setWidgetFailed(true);
          }
        } else {
          setWidgetMounted(true);
          setIsSlowLoading(false);
        }
      }, 2800);
    };
    script.onerror = () => {
      if (!isActive) return;

      target.innerHTML = "";
      setIsSlowLoading(false);
      if (seaticsHtmlSrc) {
        hasInitialized.current = false;
        setForceHtmlMode(true);
      } else {
        setWidgetFailed(true);
      }
    };
    target.appendChild(script);

    return () => {
      isActive = false;
      document.removeEventListener("submit", onSubmitCapture, true);
      document.removeEventListener("click", onClickCapture, true);
      observer.disconnect();
      if (verifyTimer) clearTimeout(verifyTimer);
      if (slowTimer) clearTimeout(slowTimer);
      if (hardFallbackTimer) clearTimeout(hardFallbackTimer);
      target.innerHTML = "";
    };
  }, [checkoutConfig, forceHtmlMode, normalizedTicketLink, normalizedWcid, scriptRetryKey, seaticsHtmlSrc, seaticsScriptSrc, shouldUseHtmlMode, useInlineSeaticsLoader, widgetEnabled]);

  function initializeWidget() {
    if (!widgetEnabled || hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      const renderer = resolveRenderer();
      if (typeof renderer !== "function") {
        setWidgetFailed(true);
        return;
      }

      renderer({
        containerId,
        eventId,
        websiteConfigId: normalizedWcid,
        bid,
        siteNumber,
        tid: ticketWidgetId,
        ticketUrl: normalizedTicketLink,
        interactiveMapUrl,
      });

      setWidgetMounted(true);
    } catch {
      setWidgetFailed(true);
    }
  }

  if (shouldUseHtmlMode) {
    return (
      <div>
        <div style={{ ...mapShellStyle, position: "relative" }}>
          {!iframeLoaded ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#555",
                fontWeight: 600,
                background: "#f8f8f8",
              }}
            >
              Loading interactive seat map...
            </div>
          ) : null}

          <iframe
            ref={htmlIframeRef}
            src={htmlIframeSrc}
            title="Interactive seat map"
            onLoad={() => {
              setIframeLoaded(true);
              setShowExternalCheckout(false);
              setBlockedCheckoutUrl(null);

              // If provider responds with a no-results shell in HTML mode,
              // retry with script mode before showing hard fallback.
              window.setTimeout(() => {
                if (!shouldSwitchToScriptMode(htmlIframeRef.current)) return;
                hasInitialized.current = false;
                setIframeLoaded(false);
                setForceScriptFallback(true);
              }, 250);
            }}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 900,
              border: "0",
              display: "block",
              opacity: iframeLoaded ? 1 : 0,
              transition: "opacity 160ms ease",
            }}
          />
        </div>

        {showExternalCheckout ? (
          <div style={{ marginTop: 12 }}>
            <a
              href={blockedCheckoutUrl || normalizedTicketLink}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 18px",
                borderRadius: 12,
                background: "#0b8f3a",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 0.2,
              }}
            >
              Open checkout in new tab
            </a>
          </div>
        ) : null}

      </div>
    );
  }

  if (widgetEnabled && useInlineSeaticsLoader) {
    return (
      <>
        {!widgetFailed ? (
          <div
            ref={seaticsContainerRef}
            id={containerId}
            style={mapShellStyle}
          />
        ) : null}

        {!widgetMounted && !widgetFailed ? (
          <p style={{ color: "#777", marginTop: 10, textAlign: "center" }}>
            Loading interactive seat map…
          </p>
        ) : null}

        {!widgetMounted && !widgetFailed && isSlowLoading ? (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                hasInitialized.current = false;
                setIsSlowLoading(false);
                setWidgetFailed(false);
                setWidgetMounted(false);
                if (seaticsHtmlSrc) {
                  setForceHtmlMode(true);
                } else {
                  const target = seaticsContainerRef.current;
                  if (target) target.innerHTML = "";
                  setScriptRetryKey((value) => value + 1);
                }
              }}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 10,
                background: "#fff",
                color: "#111",
                padding: "8px 12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry map
            </button>
          </div>
        ) : null}

        {widgetFailed ? <div style={{ marginTop: 10 }}>{renderFallback()}</div> : null}
      </>
    );
  }

  if (widgetEnabled) {
    return (
      <>
        <Script
          src={widgetScriptUrl}
          strategy="afterInteractive"
          onLoad={() => {
            initializeWidget();
          }}
          onError={() => setWidgetFailed(true)}
        />

        <div
          id={containerId}
          style={mapShellStyle}
        />

        {!widgetMounted && !widgetFailed ? (
          <p style={{ color: "#777", marginTop: 10, textAlign: "center" }}>
            Loading interactive seat map…
          </p>
        ) : null}

        {widgetFailed ? <div style={{ marginTop: 10 }}>{renderFallback()}</div> : null}
      </>
    );
  }

  if (canUseDirectMapFallback) {
    return (
      <iframe
        src={normalizedInteractiveMapUrl}
        title="Interactive seat map"
        style={{
          width: "100%",
          minHeight: 900,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "block",
          margin: "0 auto",
        }}
      />
    );
  }

  return renderFallback();
}
