# LedgerWise — ThoughtSpot Embedded Banking Demo

LedgerWise is a fictional SaaS vendor selling portfolio analytics and reporting to banks and credit unions, built to demonstrate ThoughtSpot embedded inside a modern Next.js application — live Liveboard embeds driven entirely by the host app's own chrome, ThoughtSpot trusted authentication, an AI assistant ("Marginal") backed by ThoughtSpot's MCP server, and a writeback action that turns a data point into assigned work.

The pitch is that ThoughtSpot is invisible: no ThoughtSpot logo, chrome or navigation appears anywhere in the app.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19
- **UI:** hand-written CSS in `app/globals.css` — `--lw-*` design tokens and `.lw-*` utility classes, no component library. Three [`next/font/google`](https://nextjs.org/docs/app/api-reference/components/font) families (Instrument Serif, Archivo, IBM Plex Mono) exposed as CSS variables
- **Analytics:** [ThoughtSpot Visual Embed SDK](https://developers.thoughtspot.com/docs/embed-liveboard) (**pinned exactly** — the package's npm dist-tags contain a malformed `latest]` entry) + [REST API SDK](https://developers.thoughtspot.com/docs/rest-apiv2-reference)
- **AI:** Anthropic Claude via the [Vercel AI SDK](https://ai-sdk.dev), with ThoughtSpot's hosted Spotter MCP server attached as tools — or ThoughtSpot's own `SpotterEmbed`, switchable at `/config`
- **Demo state:** [Zustand](https://zustand.docs.pmnd.rs) with `persist`, kept in step across browser tabs via the `storage` event
- **Env:** plain `process.env`, no validation layer. Every unset value degrades to a visible state that names the variable to set, so the app runs unconfigured rather than failing fast
- **Deployment:** Docker (`Dockerfile`), self-hosted via Coolify — see [Docker](#docker) and [Deploying with Coolify](#deploying-with-coolify) below

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in real values (a ThoughtSpot instance, a trusted-auth secret key, and an Anthropic API key):

   ```bash
   cp env.local.example .env.local
   ```

   See `env.local.example` for the annotated list. Note the filename — it is *not* dot-prefixed, so that the template is tracked while `.env.local` is ignored.

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

Two things that will otherwise cost you time:

- **Changing a `NEXT_PUBLIC_*` value needs `npm run build && npm start`, with the dev server stopped first.** Those values are inlined at build time, and `next dev` serves `.next/dev/` while `next build` writes `.next/` — so rebuilding while dev is running changes nothing you can see.
- **Behind a tunnel, use `npm start`, never `npm run dev`.** Dev mode's HMR websocket fails through the tunnel and the client's reaction to that interrupts form submits.

## Pages

| Route | Auth | Description |
| --- | --- | --- |
| `/` | public | Marketing landing page, built on a ledger conceit — ruled paper, a posting-reference strip, tilted data cards |
| `/login` | public | Sign-in — mints a ThoughtSpot trusted-auth session. The passphrase field is not checked |
| `/home` | required | The app shell — Marginal's ask panel, plus an exceptions list, filing calendar and activity feed |
| `/analytics` | required | One Liveboard, three tabs, with every control supplied by the host app |
| `/balances` | required | Deposit balances by region — a REST-backed accordion with a per-region Liveboard inside each expanded row |
| `/config` | **none** | Internal demo controls — not linked from the app, direct URL only |

If ThoughtSpot isn't configured, each embed renders a placeholder naming the variable to set rather than erroring.

## Analytics — the host app owns the chrome

`/analytics` embeds a single Liveboard and hides ThoughtSpot's header, tab strip and filter bar entirely. Everything around the chart belongs to LedgerWise:

- Tabs are LedgerWise buttons firing `HostEvent.SetActiveTab`, so the iframe mounts once and keeps its state across a tab change
- Filter chips are LedgerWise chips opening ThoughtSpot's own filter panels via `HostEvent.OpenFilter`
- Export is `HostEvent.DownloadAsPdf`; the highlights button is `HostEvent.AIHighlights`

Filter chips address columns by GUID, which the TML doesn't carry. `lib/filterColumns.ts` resolves them from `metadata/search` at request time, so there is nothing to hand-maintain — an unresolved chip renders disabled with the reason in its tooltip.

## Marginal

Marginal is a Claude-powered assistant with ThoughtSpot's hosted Spotter MCP server attached as tools, streamed into `/home`'s ask panel and a resizable drawer. Worth knowing:

- **Two experiences, switchable at `/config`** — Claude over the MCP server (the default), or ThoughtSpot's own `SpotterEmbed`. The switch propagates to open tabs without a reload.
- **Fully whitelabeled** — Marginal never names ThoughtSpot, Spotter or any vendor, even when a tool result does. That extends into the embed's own chrome: a hosted icon sprite and a string-replacement table swap ThoughtSpot's branding wherever it draws its own UI.
- **A session protocol, not a single call** — `create_analysis_session` → `send_session_message` → poll `get_session_updates`. The poll loop is collapsed into one tool call so Claude isn't billed a round trip per poll, while still streaming progress to the UI.
- **Visualizations render as real embeds** — answers come back carrying a raw `<iframe>` which ThoughtSpot would otherwise fill with a warning banner. `startAutoMCPFrameRenderer()` swaps each for a properly authenticated embed as it hits the DOM.
- **Two safety rails enforced in code, not prompting** — `search_objects` is deleted, and the data source is forced to the one configured model, so Marginal cannot reach anything else.
- **Query gating (demo only)** — usage can be capped by query count, configured at `/config`. Spending the last query shows an upsell dialog rather than a plain limit notice. No real billing behind it.

## Balances

`/balances` queries ThoughtSpot's Search Data API directly rather than embedding a Liveboard for its region list — real region names, checking, savings and IRA balances and customer counts, fetched server-side as the signed-in user so row-level security decides which regions appear. Expanding a region (one at a time) embeds the Liveboard scoped to it via a runtime filter.

Each row carries a stacked **deposit-mix bar**, scaled against the largest region so the track gets used — at their true platform share the five regions would all look alike. IRA is the darkest segment on purpose: it is roughly two thirds of this book, and the bar exists so that reads before any figure does. The same bar sits under *Platform total* at true proportions, so the page opens on the finding rather than hiding it until a region is expanded. **Per customer** is derived, not queried; raw totals mostly track headcount, and it is the per-capita cut that separates the regions.

Each expanded region also carries **Flag for retention review**, a *code-based* custom action in the visualization's context menu. Code-based means it is declared in the SDK view config and needs no cluster configuration at all. Raising a flag opens a dialog pre-filled from the clicked data point, and the result lands under *Needs your attention* on `/home` — the demo's closing beat, where a chart becomes assigned work. Nothing leaves the browser; flags are cleared from `/config`.

## Demo hotkeys

Configured at `/config`: record a key combo (must include Cmd/Ctrl/Alt, so it never collides with normal typing) and pair it with a saved phrase. Pressing it anywhere in the app copies the phrase to the clipboard and pastes it into whatever is focused — handy for delivering the same live-demo script the same way every time. It can't reach into ThoughtSpot's cross-origin iframe, so the clipboard copy is the fallback there.

## Embed theming

The embed's theme is a stylesheet hosted in [`jhegele-ts/industry-demos-assets`](https://github.com/jhegele-ts/industry-demos-assets) under `finance-banking/styles.css`, loaded through `customCSSUrl` and **deliberately not copied into this repo** — the same convention the other industry demos follow. It carries both the `@import` that loads the typefaces and the full `--ts-var-*` block, because a cross-origin iframe inherits none of the host page's fonts.

Shipping a change to it takes two steps, **in this order**:

1. **Purge the CDN** — `purge.jsdelivr.net/gh/jhegele-ts/industry-demos-assets@main/finance-banking/styles.css`. jsDelivr caches `@main` at the edge for 12 hours and ignores query strings.
2. **Then bump the `?v=`** in `EMBED_CSS_URL`. Browsers are told `max-age=604800`, so anyone who loaded the old file keeps it for seven days.

Bump before purging and the browser caches the old bytes under the new marker.

The **icon sprite** works the same way and follows the same rule. Both `EMBED_CSS_URL` and `ICON_SPRITE_URL` are hardcoded defaults in `lib/embedBranding.ts` with an env override in front, so a fresh clone gets the right theme and the right Spotter icon without configuring anything.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (also typechecks)
- `npm start` — run the production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck alone

There is no test suite. Verification means typecheck, lint, build, then driving the real app in a browser — several defects here have only ever appeared on hydration and were invisible to `curl`.

## Docker

`Dockerfile` is a multi-stage build (Node 22 Alpine) producing a minimal `output: "standalone"` image. For local testing, `compose.yaml` + these scripts source every var from `.env.local` automatically, so nothing needs to be retyped:

```bash
npm run docker:up     # build + run in the background
npm run docker:logs   # tail its output
npm run docker:down   # stop and remove it
```

`compose.yaml` is local-only — it has no effect on Coolify, which builds the `Dockerfile` directly (see below).

## Deploying with Coolify

Coolify builds `Dockerfile` itself; this app's env vars split across two different Coolify settings depending on when each is needed, and getting this wrong produces two different failures:

- **Build-time** (Coolify: check **"Build Variable?"** for each) — these get inlined into the client bundle by `next build`. This app has no env schema validation, so a missing one won't fail the build — it'll just bake in a placeholder-rendering client bundle that needs a rebuild to fix, not a restart:
  - `NEXT_PUBLIC_TS_HOST`, `NEXT_PUBLIC_LIVEBOARD_ID`, `NEXT_PUBLIC_SPOTTER_MODEL_ID`, `NEXT_PUBLIC_TAB_ID_OVERVIEW`, `NEXT_PUBLIC_TAB_ID_CUSTOMER`, `NEXT_PUBLIC_TAB_ID_PRODUCT`, `NEXT_PUBLIC_TAB_ID_BALANCES`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SPOTTER_PERSONA_NAME`, `NEXT_PUBLIC_SPOTTER_CARD_LABEL`, `NEXT_PUBLIC_DEMO_USERS`, `NEXT_PUBLIC_EMBED_CSS_URL`, `NEXT_PUBLIC_ICON_SPRITE_URL`, `NEXT_PUBLIC_FILTER_COL_REGION`, `NEXT_PUBLIC_FILTER_COL_STATE`, `NEXT_PUBLIC_FILTER_COL_DATE`
- **Runtime-only** (Coolify: leave **"Build Variable?" unchecked**) — real secrets and server-only config, deliberately never passed into the Docker build (which would bake them into the image's layer history):
  - `TS_SECRET_KEY`, `TS_ORG_ID`, `ANTHROPIC_API_KEY`, `TS_MCP_URL` (optional — defaults to ThoughtSpot's hosted gateway)
  - Missing/wrong here doesn't fail the build — the app degrades at runtime instead (a disabled sign-in, a chat that says it has no key), per the "no env schema validation" behavior described above.

One more thing outside this repo entirely: ThoughtSpot's own CORS allowlist and CSP Visual Embed Hosts (Develop → Customizations → Security Settings, on the ThoughtSpot instance) need the deployed domain added, or embeds and trusted-auth calls fail cross-origin.

## ThoughtSpot-side requirements

Cluster permissions, not fixable from application code:

- The signed-in user needs view access to the Liveboard and query access to the model
- `CAN_DOWNLOAD_DETAILED_DATA` for the Search Data API on `/balances` (error code `10086` is this)
- The serving origin must be on the cluster's **CSP visual-embed-host** and **CORS** allowlists, plus `cdn.jsdelivr.net`, `fonts.googleapis.com` and `fonts.gstatic.com` on `style-src`. These are **per-org** — check the org the token lands in, not Primary

A 403 with `code: 10003` and *"Service Secret code is not valid"* in the **server** log means the cluster's trusted-auth secret was rotated. That breaks sign-in, the embeds and Marginal at once, on every demo pointed at that cluster.

## Notes

- This is a demo built around a fictional company — the data is illustrative, and the exceptions list, filing calendar, activity feed and landing-page statistics are hardcoded set dressing.
- **Dates are computed, not written down.** `lib/demoClock.ts` supplies the status line under the greeting and the extract stamp on `/analytics`, resolved on the server and passed down as strings — a `new Date()` in a client component disagrees with itself across hydration. They were literals once and were a week stale before anyone noticed. Times stay fixed; `02:14 UTC` reads as an overnight batch on any day.
- The underlying data is **retail deposit and customer analytics** — balances, growth, credit scores, demographics, products, regions. There is no regulatory data behind the regulatory dressing, so anything live must only ask what the model can answer.
- Sign-in uses `auto_create: false`, so usernames must already exist on the cluster. An unknown user fails loudly rather than provisioning a junk account.
- See `CLAUDE.md` for the deeper architectural rundown — auth flow, embed invariants, the MCP wiring, and the traps that have already cost time.
