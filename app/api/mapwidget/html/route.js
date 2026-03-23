import { getEnv, normalizeEnvValue } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeCheckoutDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const normalized = raw.includes("://") ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    const host = (parsed.hostname || "").toLowerCase();
    if (!host) return "";
    return host;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] || "";
  }
}

function sanitizeCheckoutUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return parsed.toString();
  } catch {
    return raw;
  }
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const requestHost = (requestUrl.hostname || "").toLowerCase();
  const isLocalRequest = requestHost === "localhost" || requestHost === "127.0.0.1";
  const { searchParams } = new URL(request.url);
  const eventId = normalizeEnvValue(searchParams.get("eventId") || "");
  const websiteConfigId = normalizeEnvValue(searchParams.get("websiteConfigId") || "");
  const userAgent = normalizeEnvValue(searchParams.get("userAgent") || "TicketsBuzz");
  const useDarkTheme = (searchParams.get("useDarkTheme") || "").trim().toLowerCase() === "true";
  const forceMapOpen = (searchParams.get("forceMapOpen") || "true").trim().toLowerCase() !== "false";
  const ticketUrl = normalizeEnvValue(searchParams.get("ticketUrl") || "");

  const c2CheckoutUrl = isLocalRequest
    ? sanitizeCheckoutUrl(
        getEnv("TN_SEATICS_CHECKOUT_URL", "NEXT_PUBLIC_TN_SEATICS_CHECKOUT_URL"),
      )
    : "";
  const envUseC3Checkout = getEnv("TN_SEATICS_USE_C3", "NEXT_PUBLIC_TN_SEATICS_USE_C3").toLowerCase() === "true";
  const useC3Checkout = isLocalRequest ? true : envUseC3Checkout;
  const configuredC3CheckoutDomain = sanitizeCheckoutDomain(
    getEnv("TN_SEATICS_C3_CHECKOUT_DOMAIN", "NEXT_PUBLIC_TN_SEATICS_C3_CHECKOUT_DOMAIN"),
  );
  const c3CheckoutDomain = isLocalRequest
    ? configuredC3CheckoutDomain || "checkout.tickettransaction.com"
    : configuredC3CheckoutDomain;
  const c3CurrencyCode = getEnv("TN_SEATICS_C3_CURRENCY_CODE", "NEXT_PUBLIC_TN_SEATICS_C3_CURRENCY_CODE");
  const c3UtmSource = getEnv("TN_SEATICS_C3_UTM_SOURCE", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_SOURCE");
  const c3UtmMedium = getEnv("TN_SEATICS_C3_UTM_MEDIUM", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_MEDIUM");
  const c3UtmCampaign = getEnv("TN_SEATICS_C3_UTM_CAMPAIGN", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_CAMPAIGN");
  const c3UtmContent = getEnv("TN_SEATICS_C3_UTM_CONTENT", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_CONTENT");
  const c3UtmTerm = getEnv("TN_SEATICS_C3_UTM_TERM", "NEXT_PUBLIC_TN_SEATICS_C3_UTM_TERM");
  const c3PromoCode = getEnv("TN_SEATICS_C3_PROMO_CODE", "NEXT_PUBLIC_TN_SEATICS_C3_PROMO_CODE");
  const effectiveC3CurrencyCode = c3CurrencyCode || "USD";
  const forcedFallbackEventIds = new Set(
    getEnv("TN_SEATICS_FALLBACK_EVENT_IDS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (!eventId || !websiteConfigId) {
    return new Response("Missing eventId or websiteConfigId", { status: 400 });
  }

  const safeTicketUrl = ticketUrl || `https://www.ticketnetwork.com/tickets/${encodeURIComponent(eventId)}?wcid=${encodeURIComponent(websiteConfigId)}`;

  const fallbackShell = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seat map unavailable</title>
    <style>
      html, body { height: 100%; margin: 0; background: #fff; font-family: Arial, sans-serif; }
      .wrap { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
      .card { max-width: 640px; width: 100%; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; text-align: center; }
      .title { margin: 0 0 8px; font-size: 20px; color: #111; }
      .text { margin: 0 0 14px; color: #555; }
      .btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1 class="title">Seat map temporarily unavailable</h1>
        <p class="text">Please continue with tickets while we restore the interactive map.</p>
        <a class="btn" href="${safeTicketUrl}" target="_blank" rel="noreferrer">Continue to tickets</a>
      </div>
    </div>
  </body>
</html>`;

  const upstreamUrl = new URL("https://mapwidget3.seatics.com/html");
  upstreamUrl.searchParams.set("eventId", eventId);
  upstreamUrl.searchParams.set("websiteConfigId", websiteConfigId);
  upstreamUrl.searchParams.set("userAgent", userAgent);
  if (useDarkTheme) upstreamUrl.searchParams.set("useDarkTheme", "true");

  const upstreamController = new AbortController();
  const upstreamTimeout = setTimeout(() => {
    upstreamController.abort();
  }, 8000);

  let upstreamResponse;
  let snippet = "";
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      headers: {
        Accept: "text/html, text/plain, */*",
      },
      signal: upstreamController.signal,
    });
    snippet = await upstreamResponse.text();
  } catch {
    return new Response(fallbackShell, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } finally {
    clearTimeout(upstreamTimeout);
  }

  // Provider-side payloads may still include legacy checkout hosts per account settings.
  // Normalize these hosts to the configured checkout domain before injecting the HTML.
  if (c3CheckoutDomain) {
    snippet = snippet.replace(/checkout\.etickets\.ca/gi, c3CheckoutDomain);

    if (isLocalRequest) {
      // Local-only hardening: catch escaped host strings and any checkout.* host literals.
      snippet = snippet.replace(/checkout\\\.etickets\\\.ca/gi, c3CheckoutDomain.replace(/\./g, "\\\\."));
      snippet = snippet.replace(/checkout\.[a-z0-9.-]+/gi, c3CheckoutDomain);
    }
  }

  if (!upstreamResponse.ok) {
    return new Response(snippet || `MapWidget HTML fetch failed (${upstreamResponse.status})`, {
      status: upstreamResponse.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const lower = snippet.toLowerCase();
  const isFullHtml = lower.includes("<html") && lower.includes("<body");
  const hasBrokenDeploymentMarker =
    lower.includes("deployment_not_found") ||
    lower.includes("deployment cannot be found");

  if (forcedFallbackEventIds.has(eventId)) {
    return new Response(fallbackShell, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  if (hasBrokenDeploymentMarker) {
    return new Response(fallbackShell, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }
  const checkoutConfigScript = (() => {
    if (useC3Checkout && c3CheckoutDomain) {
      return `
      window.Seatics.config.useC3 = true;
      window.Seatics.config.c3CheckoutDomain = ${JSON.stringify(c3CheckoutDomain)};
      window.Seatics.config.c3CurrencyCode = ${JSON.stringify(effectiveC3CurrencyCode)};
      ${c3UtmSource ? `window.Seatics.config.c3UtmSource = ${JSON.stringify(c3UtmSource)};` : ""}
      ${c3UtmMedium ? `window.Seatics.config.c3UtmMedium = ${JSON.stringify(c3UtmMedium)};` : ""}
      ${c3UtmCampaign ? `window.Seatics.config.c3UtmCampaign = ${JSON.stringify(c3UtmCampaign)};` : ""}
      ${c3UtmContent ? `window.Seatics.config.c3UtmContent = ${JSON.stringify(c3UtmContent)};` : ""}
      ${c3UtmTerm ? `window.Seatics.config.c3UtmTerm = ${JSON.stringify(c3UtmTerm)};` : ""}
      ${c3PromoCode ? `window.Seatics.config.c3PromoCode = ${JSON.stringify(c3PromoCode)};` : ""}
      `;
    }

    if (c2CheckoutUrl) {
      return `
      window.Seatics.config.useC3 = false;
      window.Seatics.config.checkoutUrl = ${JSON.stringify(c2CheckoutUrl)};
      `;
    }

    if (ticketUrl) {
      return `
      window.Seatics.config.useC3 = false;
      window.Seatics.config.checkoutUrl = ${JSON.stringify(ticketUrl)};
      `;
    }

    return `
      window.Seatics.config.useC3 = false;
    `;
  })();

  const injectedStyle = `<style>
    html, body { height: 100%; margin: 0; background: #fff; }
    #tn-maps, .seatics, #sea-mp { height: 100% !important; min-height: 700px !important; }

    /* Hide duplicated event header/info rendered by provider */
    .sea-event-header,
    .sea-event-info,
    .sea-mp-event-header,
    .sea-mp-event-info,
    .event-info,
    .event-header,
    .venue-event-info,
    .venue-header-info,
    .sea-mp-more-info,
    .sea-more-info,
    .more-info,
    .event-more-info {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
    }

    /* Keep widget body visually centered */
    body > * { margin-left: auto !important; margin-right: auto !important; }
  </style>`;

  const injectedScript = `<script>
    (function(){
      var configuredCheckoutDomain = ${JSON.stringify((c3CheckoutDomain || "").toLowerCase())};
      var preferredCheckoutDomain = configuredCheckoutDomain || 'checkout.tickettransaction.com';

      function normalizeCheckoutUrl(url){
        if (!url) return '';
        try {
          var parsed = new URL(url, window.location.href);
          var host = (parsed.hostname || '').toLowerCase();
          var path = (parsed.pathname || '').toLowerCase();

          if (preferredCheckoutDomain && host.indexOf('checkout.') === 0) {
            parsed.protocol = 'https:';
            parsed.hostname = preferredCheckoutDomain;
            parsed.port = '';
            return parsed.toString();
          }

          if (preferredCheckoutDomain && path.indexOf('/checkout') === 0) {
            parsed.protocol = 'https:';
            parsed.hostname = preferredCheckoutDomain;
            parsed.port = '';
            return parsed.toString();
          }

          if (!host.endsWith('etickets.ca')) return parsed.toString();

          parsed.protocol = 'https:';
          parsed.hostname = preferredCheckoutDomain;
          parsed.port = '';
          return parsed.toString();
        } catch (e) {
          return String(url).replace(/checkout\.etickets\.ca/gi, preferredCheckoutDomain);
        }
      }

      function isCheckoutLikeUrl(url){
        if (!url) return false;
        try {
          var parsed = new URL(url, window.location.href);
          var host = (parsed.hostname || '').toLowerCase();
          var path = (parsed.pathname || '').toLowerCase();

          if (path.indexOf('/checkout') === 0) return true;

          if (configuredCheckoutDomain && host === configuredCheckoutDomain) return true;
          if (host.indexOf('checkout.') === 0) return true;
          if (host.indexOf('ticketnetwork.com') >= 0 && path.indexOf('checkout') >= 0) return true;

          return false;
        } catch (e) {
          return false;
        }
      }

      function forceCheckoutToTop(){
        var nativeSubmitPatched = false;

        function forceTopNavigation(url){
          if (!url) return;
          var normalized = normalizeCheckoutUrl(url);
          try {
            if (window.top && window.top !== window) {
              window.top.location.href = normalized;
            } else {
              window.location.href = normalized;
            }
          } catch (e) {
            window.location.href = normalized;
          }
        }

        function looksLikeCheckoutPath(url){
          if (!url) return false;
          var raw = String(url).toLowerCase();
          return raw.indexOf('/checkout/order') >= 0 || raw.indexOf('/checkout') >= 0;
        }

        function patchNativeSubmit(){
          if (nativeSubmitPatched) return;
          if (!window.HTMLFormElement || !window.HTMLFormElement.prototype) return;

          var originalSubmit = window.HTMLFormElement.prototype.submit;
          if (typeof originalSubmit !== 'function') return;

          window.HTMLFormElement.prototype.submit = function(){
            try {
              var action = this.getAttribute('action') || this.action || '';
              if (isCheckoutLikeUrl(action) || looksLikeCheckoutPath(action)) {
                var normalizedAction = normalizeCheckoutUrl(action);
                if (normalizedAction) this.setAttribute('action', normalizedAction);
                this.setAttribute('target', '_top');
                // Preserve provider POST/session payload by allowing native submit.
                return originalSubmit.apply(this, arguments);
              }
            } catch (e) {}

            return originalSubmit.apply(this, arguments);
          };

          nativeSubmitPatched = true;
        }

        function promoteCheckoutIframes(){
          var iframes = document.querySelectorAll('iframe[src]');
          for (var i = 0; i < iframes.length; i++) {
            var src = iframes[i].getAttribute('src') || '';
            if (!isCheckoutLikeUrl(src)) continue;
            var normalizedSrc = normalizeCheckoutUrl(src);
            if (normalizedSrc) {
              iframes[i].setAttribute('src', normalizedSrc);
              src = normalizedSrc;
            }

            try {
              if (window.top && window.top.location && window.top.location.href !== src) {
                window.top.location.href = src;
              }
            } catch (e) {
              window.location.href = src;
            }
            return;
          }
        }

        patchNativeSubmit();

        document.addEventListener('submit', function(event){
          var form = event.target;
          if (!form || form.tagName !== 'FORM') return;
          var action = form.getAttribute('action') || '';
          if (!isCheckoutLikeUrl(action) && !looksLikeCheckoutPath(action)) return;
          var normalizedAction = normalizeCheckoutUrl(action);
          if (normalizedAction) {
            form.setAttribute('action', normalizedAction);
          }

          // Preserve payload/session by allowing native submit but escaping iframe context.
          form.setAttribute('target', '_top');
        }, true);

        document.addEventListener('click', function(event){
          var node = event.target;
          while (node && node !== document.body) {
            if (node.tagName === 'A') {
              var href = node.getAttribute('href') || '';
              if (isCheckoutLikeUrl(href) || looksLikeCheckoutPath(href)) {
                var normalizedHref = normalizeCheckoutUrl(href);
                if (normalizedHref) {
                  node.setAttribute('href', normalizedHref);
                }
                node.setAttribute('target', '_top');
                node.setAttribute('rel', 'noreferrer noopener');
                return;
              }
            }
            node = node.parentElement;
          }
        }, true);

        try {
          var originalOpen = window.open;
          if (typeof originalOpen === 'function') {
            window.open = function(url){
              if (isCheckoutLikeUrl(url) || looksLikeCheckoutPath(url)) {
                forceTopNavigation(url);
                return null;
              }
              return originalOpen.apply(window, arguments);
            };
          }
        } catch (e) {}

        var checkoutObserver = new MutationObserver(function(){ promoteCheckoutIframes(); });
        checkoutObserver.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        promoteCheckoutIframes();
        setTimeout(function(){ checkoutObserver.disconnect(); }, 45000);
      }

      function clearLikelySavedFilters(){
        try {
          if (!window.localStorage) return;
          var keys = [];
          for (var i = 0; i < window.localStorage.length; i++) {
            var key = window.localStorage.key(i);
            if (!key) continue;

            var lower = key.toLowerCase();
            var looksLikeFilter = lower.indexOf('filter') >= 0;
            var looksLikeVendorKey = lower.indexOf('seatics') >= 0 || lower.indexOf('ticketnetwork') >= 0 || lower.indexOf('sea_') >= 0 || lower.indexOf('sea-') >= 0;
            if (looksLikeFilter && looksLikeVendorKey) {
              keys.push(key);
            }
          }

          for (var j = 0; j < keys.length; j++) {
            window.localStorage.removeItem(keys[j]);
          }
        } catch (e) {}
      }

      function hideDuplicateHeader(){
        var all = Array.prototype.slice.call(document.querySelectorAll('button, a, div, span, h1, h2, h3, p'));
        for (var i = 0; i < all.length; i++) {
          var text = (all[i].textContent || '').trim().toLowerCase();
          if (!text) continue;

          var looksLikeMoreInfo = text === 'more info' || text.indexOf('more info') >= 0;
          var looksLikeDateLine = text.indexOf('@') >= 0 && (text.indexOf('pm') >= 0 || text.indexOf('am') >= 0);
          var looksLikeLocationLine = text.indexOf(',') >= 0 && (text.indexOf('center') >= 0 || text.indexOf('arena') >= 0 || text.indexOf('theatre') >= 0 || text.indexOf('theater') >= 0 || text.indexOf('stadium') >= 0 || text.indexOf('hall') >= 0);

          if (!(looksLikeMoreInfo || looksLikeDateLine || looksLikeLocationLine)) continue;

          var node = all[i];
          for (var depth = 0; depth < 4 && node && node.parentElement; depth++) {
            node = node.parentElement;
          }

          if (!node || !node.getBoundingClientRect) continue;
          var rect = node.getBoundingClientRect();
          if (rect.top > 220 || rect.height > 260) continue;

          node.style.display = 'none';
          node.style.visibility = 'hidden';
          node.style.height = '0';
          node.style.overflow = 'hidden';
        }
      }

      clearLikelySavedFilters();
      forceCheckoutToTop();
      hideDuplicateHeader();
      var observer = new MutationObserver(function(){ hideDuplicateHeader(); });
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
      setTimeout(function(){ observer.disconnect(); }, 20000);
    })();
  </script>`;

  const seaticsConfigScript = `<script>
      window.Seatics = window.Seatics || {};
      window.Seatics.config = window.Seatics.config || {};
      ${forceMapOpen ? "window.Seatics.config.smallScreenMapLayout = 3;" : ""}
      window.Seatics.config.skipPrecheckoutMobile = false;
      window.Seatics.config.skipPrecheckoutDesktop = false;
      window.Seatics.config.saveFilterOptions = false;
      ${checkoutConfigScript}
    </script>`;

  const html = isFullHtml
    ? snippet
        .replace(/<head[^>]*>/i, (tag) => `${tag}${injectedStyle}`)
        .replace(/<body[^>]*>/i, (tag) => `${tag}${injectedScript}${seaticsConfigScript}`)
    : `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MapWidget</title>
    ${injectedStyle}
  </head>
  <body>
    ${injectedScript}
    ${seaticsConfigScript}
    ${snippet}
    <script>
      (function(){
        if (!${forceMapOpen ? "true" : "false"}) return;

        function tryOpenMap(){
          var selectors = [
            '.sea-map-shower-js',
            '.sea-mp-map-shower',
            '.show-map-js',
            '.sea-mp-map-shower-js',
            'button[aria-label*="Map"]'
          ];
          for (var s = 0; s < selectors.length; s++) {
            var node = document.querySelector(selectors[s]);
            if (node) { node.click(); return true; }
          }

          var all = Array.prototype.slice.call(document.querySelectorAll('button, a, div'));
          for (var i = 0; i < all.length; i++) {
            var text = (all[i].textContent || '').trim().toLowerCase();
            if (text === 'show map' || text.indexOf('show map') >= 0) {
              all[i].click();
              return true;
            }
          }
          return false;
        }

        var attempts = 0;
        var timer = setInterval(function(){
          attempts += 1;
          if (tryOpenMap() || attempts > 30) {
            clearInterval(timer);
          }
        }, 350);

        var observer = new MutationObserver(function(){
          if (tryOpenMap()) {
            observer.disconnect();
          }
        });

        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
        });

        setTimeout(function(){ observer.disconnect(); }, 15000);
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
