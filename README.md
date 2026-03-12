This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## TicketsBuzz feature flags

Use this env var to control map-first behavior on the event detail page:

- `NEXT_PUBLIC_REQUIRE_MAP_INTERACTION_BEFORE_BUY`
	- `false` (default): page does not show map-first guidance text.
	- `true`: page shows guidance to select seats in the interactive map before checkout.

Use this env var to control whether to show the external TicketNetwork checkout button:

- `NEXT_PUBLIC_TN_ENABLE_EXTERNAL_CHECKOUT`
	- `false` (default / recommended for now): hides external checkout CTA and keeps the flow fully in-page during seat selection.
	- `true`: shows **Continue to checkout** button on `/event/[id]/tickets`.

Temporary hosted checkout bridge (MapWidget-side):

- C2 checkout URL
	- `TN_SEATICS_CHECKOUT_URL` (or `NEXT_PUBLIC_TN_SEATICS_CHECKOUT_URL`)
	- Example: `https://tickettransaction2.com/Checkout.aspx?utm_source=source&utm_medium=medium`

- C3 checkout
	- `TN_SEATICS_USE_C3=true`
	- `TN_SEATICS_C3_CHECKOUT_DOMAIN=https://checkout.domain.com`
	- Optional: `TN_SEATICS_C3_CURRENCY_CODE`, `TN_SEATICS_C3_UTM_SOURCE`, `TN_SEATICS_C3_UTM_MEDIUM`, `TN_SEATICS_C3_UTM_CAMPAIGN`, `TN_SEATICS_C3_UTM_CONTENT`, `TN_SEATICS_C3_UTM_TERM`, `TN_SEATICS_C3_PROMO_CODE`

Notes:

- This is a temporary hosted checkout handoff (C2/C3), not a full native TicketsBuzz checkout.
- C3 takes precedence over C2 when both are configured.

Use these env vars to enable embedded MapWidget3 integration on event pages:

- `NEXT_PUBLIC_TN_ENABLE_MAPWIDGET3`
	- `false` (default / production-safe): widget is disabled and page shows setup guidance.
	- `true`: enables script-based widget rendering.
- `NEXT_PUBLIC_TN_MAPWIDGET_SCRIPT_URL`
	- Full URL of the provider script from the MapWidget3 integration guide.
- `NEXT_PUBLIC_TN_BID`
	- TicketNetwork BID (example provided by team: `4579`).
- `NEXT_PUBLIC_TN_SITE_NUMBER`
	- TicketNetwork site number (example provided by team: `1`).

Interactive flow routes:

- `/event/[id]`: event details + entry point.
- `/event/[id]/tickets`: interactive map page (in-site experience before external checkout).

Recommended rollout order:

1. Deploy with `NEXT_PUBLIC_TN_ENABLE_MAPWIDGET3=false`.
2. Set `NEXT_PUBLIC_TN_MAPWIDGET_SCRIPT_URL`, `NEXT_PUBLIC_TN_BID`, and `NEXT_PUBLIC_TN_SITE_NUMBER` in preview.
3. Enable `NEXT_PUBLIC_TN_ENABLE_MAPWIDGET3=true` in preview.
4. Validate `/event/[id]/tickets` widget rendering.
5. Keep `NEXT_PUBLIC_TN_ENABLE_EXTERNAL_CHECKOUT=false` while in-site checkout is pending.
6. When business approves external redirect behavior, set `NEXT_PUBLIC_TN_ENABLE_EXTERNAL_CHECKOUT=true`.
7. Promote to production only after preview validation.
