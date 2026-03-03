# Technical Evidence Summary (Backend)

## 1) GEO Search Availability

Status: **Implemented in API and flow**

- Home detects city header (`x-vercel-ip-city`) and calls events API with `city`.
- Events API receives `city` and maps it to TicketNetwork `cityZip`.
- Search API has fallback using `cityZip`/`venueName` when needed.

Code evidence:
- `app/page.tsx` (city detection + API call with `city`)
- `app/api/events/route.js` (maps query `city` to provider `cityZip`)
- `app/api/search/route.js` (fallback strategy with `cityZip`)

## 2) Pricing / Markup Verification

Status: **Provider price evidence generated; frontend displayed-price comparison pending**

- Script created to fetch provider ticket prices (`RetailPrice`, `WholesalePrice`) by event id.
- Output CSV generated for business review.

Files:
- `scripts/price-audit.mjs`
- `docs/price-audit.csv`

## 3) Current Evidence Snapshot (from CSV)

- Raptors (`eventId=7703845`): provider min retail = `135.47`
- Concert (`eventId=7640734`): provider min retail = `124`
- Toronto GEO sample (`eventId=7380491`): provider min retail = `251.36`
- Vegas/Baseball sample IDs currently returned no ticket groups in this run (`groups_count=0`)

## 4) What is still needed to close Peter’s request

1. Frontend must expose/display final ticket price for the same event/section.
2. Add `displayed_price` in CSV and compute:

`markup_pct = ((displayed_price - provider_min_retail) / provider_min_retail) * 100`

3. Share final table by category (Raptors, Vegas, Baseball, Concerts).

## 5) Suggested non-technical message

"Backend GEO and provider-pricing evidence are ready. Final competitiveness comparison is pending frontend displayed prices, after which we can calculate exact markup percentages by category and event."
