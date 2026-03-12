# TicketsBuzz – MapWidget3 + C3 Support Packet

Date: 2026-03-05  
Environment: Production-like local validation on TicketsBuzz app  
Domain in use for C3 checkout: checkout.ticketsbuzz.com  
WCID in use: 23933

## 1) Issue Summary

We are integrating MapWidget3 with C3 checkout for TicketsBuzz.  
C3 config is implemented in the map page, but the interactive map frequently renders as blank or ends in a controlled fallback message:

- “The interactive seat map is temporarily unavailable for this event.”

This behavior is reproducible for multiple events, not a single isolated event.

## 2) Expected Behavior (per support guidance)

Support guidance states we should configure:

- Seatics.config.c3CheckoutDomain = "checkout.ticketsbuzz.com"
- Seatics.config.c3CurrencyCode = "USD"
- Seatics.config.useC3 = true
- WCID must be 23933 for ticketsbuzz.com
- CNAME for host `checkout` should point to `c3.ticketnetwork.com`

## 3) Current Implementation Status

Implemented in app code:

- C3 enabled and injected in script mode: [app/components/EventSeatMap.tsx](app/components/EventSeatMap.tsx#L163-L171)
- C3 enabled and injected in HTML proxy mode: [app/api/mapwidget/html/route.js](app/api/mapwidget/html/route.js#L112-L122)
- WCID sourced as 23933 on event pages: [app/event/[id]/page.tsx](app/event/[id]/page.tsx), [app/event/[id]/tickets/page.tsx](app/event/[id]/tickets/page.tsx#L65-L66)

Configured in env:

- TN_WCID=23933
- TN_SEATICS_USE_C3=true
- TN_SEATICS_C3_CHECKOUT_DOMAIN=checkout.ticketsbuzz.com
- TN_SEATICS_C3_CURRENCY_CODE=USD
- UTM/Promo defaults populated

Reference: [.env.local](.env.local#L8-L33)

## 4) Repro Events

Observed on examples including:

- Event ID 7509945
- Event ID 7509949

(Additional event IDs can be provided on request.)

## 5) Objective Technical Evidence

### A) DNS record type for checkout.ticketsbuzz.com

Command output:

- Type A -> 216.150.16.1
- Type A -> 216.150.1.129

Observation:

- Current DNS is A-record based, while support guidance indicates checkout host should be a CNAME to c3.ticketnetwork.com.

### B) Direct upstream MapWidget3 endpoint behavior

Request:

- https://mapwidget3.seatics.com/html?eventId=7509945&websiteConfigId=23933&userAgent=TicketsBuzz&forceMapOpen=true

Observed:

- HTTP status: 200
- Response length: 23388
- No iframe marker found in payload
- No explicit `deployment_not_found` marker in this specific payload

Interpretation:

- Upstream endpoint returns successful HTTP response but payload does not consistently produce a renderable map in our integration context.

## 6) What We Need from Support

Please confirm the following explicitly:

1. Is WCID 23933 fully enabled for MapWidget3 + C3 in Production (not only API token access)?
2. For ticketsbuzz.com, must DNS be strictly `checkout` CNAME -> `c3.ticketnetwork.com` (and are current A records invalid for C3 routing)?
3. For the endpoint above, should a valid response include specific render markers (iframe/container/script bootstrap), and what are they?
4. Are there known event-level constraints that cause blank map payloads even with HTTP 200?
5. Please validate these event IDs on your side (starting with 7509945, 7509949) under WCID 23933 and share findings.

## 7) Attachments to Include in Ticket

- Screenshot(s) of blank/failed map state from TicketsBuzz event page
- This support packet
- Prior email thread about WCID 23933 and C3 domain guidance

## 8) Desired Outcome

- Stable interactive map render for WCID 23933 events
- Correct C3 buy-button routing to checkout.ticketsbuzz.com
- Confirmed DNS and provider-side configuration with no ambiguity
