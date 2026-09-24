# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # localhost:3000
npm run build            # production build (also typechecks)
npm start                # serve the build
npm run lint             # eslint
npx tsc --noEmit         # typecheck alone
```

**Changing a `NEXT_PUBLIC_*` value means `npm run build && npm start`, and
the dev server must be STOPPED first.** Those values are inlined at build
time, but the trap is worse than a stale value: `npm run dev` serves
`.next/dev/`, while `npm run build` writes `.next/`. Rebuilding while dev is
running changes nothing about what the browser sees, and nothing says so —
the old value simply persists, which reads as a caching problem and survives
every cache fix you try. Check with
`lsof -ti:3000` before concluding anything about an env value, and confirm
which build is live by grepping for the value:
`grep -rl "<the value>" .next/static .next/dev/static`

**"I changed something and nothing happened" is a caching question until
proved otherwise — check what the browser actually received before theorising
about why.** This has now cost several hours across four unrelated
mechanisms, each with the identical symptom and each masking the next:

| Mechanism | Lifetime | How to clear |
|---|---|---|
| jsDelivr edge on `@main` | 12h, ignores query strings | `purge.jsdelivr.net/gh/...` |
| Browser, on a jsDelivr URL | 7 days (`max-age=604800`) | bump the `?v=` |
| `npm run dev` serving `.next/dev/` | until dev is stopped | stop it, `npm start` |
| Browser, on a page whose chunk hashes moved | until cleared | Application > Clear site data |

**A clean-profile load takes ten seconds and separates "broken" from
"cached" immediately** — an incognito window, or Playwright, which also hands
you the console and the failed requests. Do that first. Every one of those
four was diagnosed the slow way, by reasoning forward from config, and every
time the reasoning produced a confident wrong answer.

There is no test suite. Verification means `npx tsc --noEmit`, `npm run lint`,
`npm run build`, then driving the real app in a browser. Several defects here
have only ever appeared on hydration and were invisible to `curl` — the
guarded `init()` below is one.

**`/home`, `/analytics` and `/balances` need a live session.** Sign-in mints a
real ThoughtSpot token, so those three can't be opened cold. To check layout
or behaviour without signing in, drop a temporary server component under
`app/dev-preview/<page>/` that renders the client component with literal
props, drive it, and delete it before committing. (Not `app/_preview/` — a
leading underscore is Next's private-folder convention and the route 404s.)
Inside such a preview the ThoughtSpot embeds render "Not logged in"; that is
the SDK, not a bug.

Config lives in `.env.local`. **`.env*` is blocked by a permission rule here**
— ask the user to create or edit it rather than trying to write it yourself.

## What this is

A ThoughtSpot Embedded sales-demo app for a fictional bank-analytics vendor,
"LedgerWise", running against the `thoughtspotpmm` cluster. The pitch is that
ThoughtSpot is invisible: no ThoughtSpot logo, chrome or navigation anywhere.

| Route | Auth | What it embeds |
|---|---|---|
| `/` | public | nothing — a drawn `fig. 01` liveboard |
| `/login` | public | mints a trusted-auth token |
| `/home` | required | Marginal — MCP **or** Spotter, switchable |
| `/analytics` | required | one liveboard, three tabs, native filter chips |
| `/balances` | required | one liveboard per region, runtime-filtered, + flag action |
| `/config` | **none** | demo controls, unlinked, localStorage only |

Three reference artefacts, each authoritative for something different:

- **The Claude Design canvas** `b6c7793e-7804-499a-b1aa-fd940827894f`
  ("LedgerWise Banking", owned by Ron Dugger) — source of truth for visual
  design and copy. Read its artboards with `DesignSync` before changing
  layout, colour or wording. It is a regular project, not a design system, so
  it will never appear in `DesignSync list_projects`; address it by UUID.
- **The liveboard's exported TML** — every GUID in `env.local.example` came
  from it, and it is the fastest answer to "what columns/tabs/filters actually
  exist". **It is deliberately not in the repo** (it carries the board's
  demo-script tile), so export it fresh from ThoughtSpot when you need it
  rather than trusting a copy. Worth knowing that the copy this project worked
  from went stale on `Viz_27`, the AI insight tile: the live tile read two CSVs
  and printed a Research section while the export read one and printed
  neither. Re-export before drawing conclusions from any tile.
- **[jhegele-ts/industry-demo-iot-manufacturing](https://github.com/jhegele-ts/industry-demo-iot-manufacturing)**
  ("Fulcra") — a working demo of the same shape. **Consult it before changing
  the ThoughtSpot layer.** An earlier hand-rolled MCP integration here was
  wrong in every important detail and that repo is what corrected it.

**The artboards invent things the liveboard does not have.** The
"Institution" filter chip and the "Regulatory variance" tab both came from
the canvas with no counterpart on the board, and both were eventually
removed rather than pointed at something approximate. Export the liveboard's
TML and check it before porting a control off an artboard; nothing in the
repo knows what the board really contains.
`LedgerWise-one-pager.md` is an internal explainer, exported from a Claude doc
— the doc is canonical, so re-export rather than editing the `.md` by hand.

**`/`, `/login` and `/home` deliberately diverge from their artboards.** Login
and Home were asked to be calmer: Login drops the marquee, blinking dot, stats
panel, trust/MFA controls and duplicate SSO buttons; Home drops the blinking
dot, offset shadow, severity meter, progress bars and sparkline grid, unifying
everything into `.lw-card`. `/` was asked to do the opposite — to "pop" — and
is built on a **ledger conceit**: ruled paper, a posting-reference strip where
a spreadsheet would put a formula bar, a numbered rail, tilted data cards on
hard shadows, and schedule tabs pinned to the bottom. **Do not "restore" any of
the three to match the canvas** — push the redesigns to the canvas instead.

The demo path is **`/` → Log in → `/home`**.

## Architecture

### Two ThoughtSpot integrations, two transports

The analytics surfaces share nothing but the auth token:

- **Liveboards** (`/analytics`, `/balances`) use the Visual Embed SDK.
- **Marginal** (`/home`) is Claude (Vercel AI SDK) orchestrating ThoughtSpot's
  **Spotter MCP server**, server-side, in `/api/marginal` — *or* ThoughtSpot's
  own `SpotterEmbed`, switchable from `/config`.

Four things about the MCP path are easy to get wrong and expensive to
rediscover:

1. **The endpoint is a hosted gateway**, `https://agent.thoughtspot.app/token/mcp`
   — *not* a path on the cluster. The cluster is named by the **`x-ts-host`
   header** (hostname only, scheme stripped) alongside the bearer token.
2. **It is a session protocol, not a single call**: `create_analysis_session`
   → `send_session_message` → poll `get_session_updates` until `is_done`.
   There is no one-shot "ask" tool.
3. **Results arrive as an event stream** under `session_updates` —
   `step_notification` (progress), `text_chunk` (answer fragments; skip any
   with `is_thinking: true`, concatenate the rest with no separator), and
   `answer` (carries `iframe_url`).
4. **`get_session_updates` is wrapped** in `lib/thoughtspot-mcp.ts` to poll to
   completion in one call. Left raw, every poll costs a full Claude round
   trip. The wrapper is an async generator, so each poll still streams a
   progress line to the UI.

Two safety rails are enforced in code, not prompting: `search_objects` is
deleted (it searches the whole object catalog with no way to scope it), and
`create_analysis_session` always has `data_source_id` forced to the model.

### Auth: existing cluster accounts only

`lib/thoughtspot-auth.ts` (server actions) mints a trusted-auth token via the
REST SDK's `getFullAccessToken` with **`auto_create: false`**, so the username
must already exist on the cluster — the cluster is the allowlist, there is no
app-level user table. The token lives in an httpOnly cookie for 24h;
`lib/thoughtspot-user.ts` resolves the display name from
`getCurrentUserInfo()`.

The endpoint defaults `auto_create` to **true**, which silently provisions
anyone who types an address, typos included. It was briefly on here and was
turned off deliberately; don't let it drift back.

The trade is that sign-in fails for unknown users, and the browser gets one
generic message because an unknown username and a sleeping instance land in
the same catch. **The server log has the real cause** — check the terminal,
not the console. `NEXT_PUBLIC_DEMO_USERS` optionally renders click-to-fill
hints on the login page; it grants nothing.

Guarding is deliberately split:

- `proxy.ts` checks only that the cookie **exists** — middleware can't
  validate a token without a network call.
- The **page** calls `getCurrentUser()` and redirects to `/login` on null.
- `/login` redirects to `/home` only on a **validated** lookup.

Never make `/login` bounce on cookie presence alone. Presence-based redirects
on both sides loop forever once a cookie outlives its token.

### Addressing columns: three schemes, don't mix them

The same column is named three different ways depending on who is asking:

| Consumer | Wants | Example |
|---|---|---|
| Runtime filters (`/balances`) | column **name** | `Customer Region` |
| `HostEvent.OpenFilter` (`/analytics`) | column **GUID** | `6ee376d0-…` |
| Liveboard TML | **qualified name** | `Industry Demo - Banking::Customer Region` |

`OpenFilter` has no name-based form and the TML carries no GUIDs, so
`lib/filterColumns.ts` resolves them from `metadata/search` with
`include_details: true`, cached per request. Nothing to hand-maintain.

`HostEvent.GetFilters` looks like the obvious source and is not: its response
is `{column: "Region", operator, values, …}` — a name, no GUID.

The resolver walks the response **structurally** (anything with both a name
and a GUID-shaped id) rather than reading a fixed path, because the payload
shape varies by cluster version and worksheet-vs-model, and a hard-coded path
fails *silently*. Hits are ranked by source key: `columns` carries display
names, `header` mixes display and physical, `logicalColumn` is physical only
(`REGION`) — so `columns` wins. `NEXT_PUBLIC_FILTER_COL_*` remain per-column
overrides; an unresolved chip renders disabled with the reason in its tooltip.

The liveboard has exactly **three** saved filters. The artboard also drew an
"Institution" chip; no such filter exists, so it isn't rendered.

### Embed invariants

Breaking these produces failures that look like ThoughtSpot bugs:

- **Every prop passed to an embed must have a stable identity.** The SDK
  deep-compares its view config and destroys/recreates the iframe when one
  changes; an object literal in JSX is a new identity every render. Objects
  live at module scope, or frozen in `useState` — never inline. Callbacks are
  empty-dep `useCallback`s that read stores via `getState()`.
- **The active tab is not a prop.** `/analytics` embeds *one* liveboard and
  switches tabs with `HostEvent.SetActiveTab` on a ref. `activeTabId` is
  passed once at mount and never rebound — binding it to state changes the
  view config on every click, tearing down the iframe and wiping the user's
  filters.
- **`init()` is guarded on a non-empty host** in `lib/embedInit.ts`. It throws
  `Error parsing ThoughtSpot host` on an empty string, and since every embed
  view imports that module at module scope, an unguarded call takes the page
  down on hydration whenever `NEXT_PUBLIC_TS_HOST` is unset. It must stay at
  module scope, not in an effect — React fires child effects before parents',
  so an embed can otherwise construct before init runs. `/home` imports it
  too, for the MCP frame renderer below.
- **`resetCachedAuthToken()` runs on sign-in and sign-out.** The SDK caches
  the last token on `window` regardless of app-level user.
- The Visual Embed SDK is **pinned exactly** (`1.52.0`). The package's npm
  dist-tags contain a malformed `latest]` entry, so `@latest` is unreliable.
- `HostEvent` and `EmbedEvent` have overlapping names. `ResetLiveboard` is an
  **EmbedEvent** (emitted by the embed), not a command. To clear filters,
  `trigger(HostEvent.UpdateRuntimeFilters, [])` — it resets to the saved state
  and applies exactly what's passed.

### /balances: searchdata + one embed per region

Regions come from the **searchdata REST API** (`lib/balances.ts`, `DataApi`),
queried server-side as the signed-in user so RLS decides which appear.
`record_size: -1` means "all rows". Expanding a region embeds the liveboard's
Balances tab scoped by a `Customer Region` runtime filter.

- ThoughtSpot **renames aggregated measures** — `sum [Current Savings
  Balance]` returns as `Total Current Savings Balance`. `measure()` tries the
  likely prefixes rather than silently reading zero.
- The embed mounts **only while its section is open**, so its runtime filter
  is set once at mount. Each section has `key={region}`, making a region
  switch a clean remount.
- Refresh is `router.refresh()` inside a `useTransition`, re-running the
  server component rather than holding a second client-side cache.

### Retention flags: the writeback beat

**Built to be removed in one commit.** The demo's closing move, modelled on
Fulcra's sibling FP&A demo ("Forepost"), whose arc is *vague concern → agent
narrows it → drill to an entity → flag it → assign someone*. Without this the
tour ends on a chart; with it, work exists that didn't five minutes ago. It is
also the only thing covering "insight to action" in the TSE Embedded Advantage
framework.

A **code-based** custom action — "Flag for retention review" — appears in the
context menu of any viz on the `/balances` board. Clicking it opens a
pre-filled dialog; submitting adds a flag that renders above the static
exceptions under *Needs your attention* on `/home`.

Three things about it are load-bearing:

- **Code-based means NO cluster configuration.** It is declared in the view
  config (`lib/customActions.ts`, SDK 1.43.0+ / ThoughtSpot 10.14.0.cl+), not
  in Develop > Custom actions. Nothing has to be set up on the cluster, which
  is what makes it safe when the app is repointed. A UI-configured action
  sharing the id would suppress it.
- **The callback carries no viz data.** That is documented for code-based
  actions on liveboards, not a bug. Everything the dialog pre-fills comes from
  the host instead: the region from the embed that fired, and the cohort and
  value from the last `EmbedEvent.VizPointClick`, captured into a ref as it
  happens. Raised without clicking a point first, it degrades to a
  region-level flag rather than refusing.
- **Both embed handlers must have a stable identity.** The React wrapper puts
  listeners in a deep-compare dependency array where functions compare by
  reference, so an inline arrow rebuilds the iframe on every parent render.
  `region` is safe as a dep only because the parent keys each embed by region;
  `onFlag` is a `useCallback` in `BalancesClient`.

The dialog is keyed by an epoch so each opening remounts with fresh state —
resetting in an effect instead trips `react-hooks/set-state-in-effect`, and
writing the parent's props into refs during render trips `react-hooks/refs`.
Both rules bit during the build.

**Nothing leaves the browser.** `stores/retentionFlags.ts` is localStorage
like the other three, synced across tabs, with a clear control on `/config`.
Say so if a prospect asks — the point is that the embed hands context back to
the host, not that we ship case management. Keep the copy off regulatory
language: the data has no HMDA, FFIEC or institution dimension.

**To remove:** delete `lib/customActions.ts`, `stores/retentionFlags.ts`,
`components/RetentionFlagDialog.tsx`, the `.lw-flag*` block at the end of
`app/globals.css`, and the flag sections in `BalancesClient`, `HomeClient`,
`RegionLiveboard` and `ConfigClient`.

### /config: demo controls, all client-side

`/config` is an unlinked, unauthenticated page of demo switches, modelled on
Fulcra's. Everything lives in `localStorage` via three Zustand stores in
`stores/` — nothing reaches ThoughtSpot, nothing is shared, and it is useful
before signing in, which is why it is not behind the proxy.

- **Agent experience** (`appConfig`) — `mcp` (default) or `spotter`.
  `MarginalChat` swaps its whole body and hides its own composer in Spotter
  mode, since Spotter brings one.
- **Query gating** (`monetization`) — a usage meter in the chat header plus a
  hard block once spent. Defaults sit near the limit (497/500) so the moment
  is reachable without 500 clicks.
- **Hotkeys** (`hotkeys`) — a saved combo copies a stored question to the
  clipboard and pastes it into whatever is focused.

`stores/crossTab.ts` keeps all three in step **between tabs**. A Zustand store
is a module singleton per page load: `persist` reads localStorage once at
creation and never looks again, so a change on `/config` would not reach the
app until a reload — and `/config` is nearly always open in its own tab. Each
store listens for the `storage` event (which fires only in *other* tabs) and
calls `persist.rehydrate()`.

Four things worth not breaking:

- **Persisted stores need `useHydrated()`** (`lib/useHydrated.ts`). They read
  `localStorage` client-side only, so bound UI renders defaults on the server
  and real values on the client — a hydration mismatch. That hook uses
  `useSyncExternalStore` deliberately, so there is no setState during render
  or in an effect (which `react-hooks/set-state-in-effect` forbids).
- **`ask()` reads the store with `getState()`, not a subscription** — it must
  see usage as of that click, including a `consumeQuery()` from the message
  immediately before.
- **The two experiences count in different places.** MCP consumes in `ask()`;
  Spotter consumes from `EmbedEvent.SpotterQueryTriggered`, because its
  questions are typed inside the iframe and never reach `ask()`. Change one
  and check the other still counts exactly once.
- **The hotkey listener binds in the capture phase.** With focus already in a
  text field, a bubble-phase listener runs too late: the browser may act on
  the keystroke first (Alt combos can start dead-key composition) and
  `preventDefault` can no longer cancel it. Combos require a modifier at save
  time, which is what makes matching safe regardless of focus. It cannot reach
  ThoughtSpot's cross-origin iframes — the clipboard copy is the fallback.

#### Spent and blocked are not the same instant

The count is consumed at send, so the meter ticks immediately, but the blocked
UI waits on nothing being in flight. Otherwise spending the last query tears
down the composer — and in Spotter mode the embed itself — while that answer
is still arriving, which reads as the question having been cancelled. Spotter's
in-flight window comes from bracketing `SpotterQueryTriggered` /
`SpotterResponseComplete`, with a 120s timeout in case completion never lands.

**Never unmount the Spotter embed to block it.** Doing so destroys the
conversation, including the answer the last query paid for. The blocked message
replaces the embed only when `!spotterUsed` — nothing asked yet, nothing to
lose. Once a conversation exists the limit is a banner above the embed and the
transcript stays readable. Fulcra unmounts here; this deliberately does not.

Spent, the Home ask panel swaps its suggested prompts for a usage line,
disables its input and offers `QueryLimitDialog` — whose CTA doubles
`totalQueries`. `HomeClient` owns that dialog so the panel and the chat footer
open the same one.

### The Marginal chat panel

`MarginalChat` is a modal owned by `HomeClient`. Several behaviours are
load-bearing:

- **Closing hides, it does not end.** `messages` lives in `HomeClient`, so
  dismissing (scrim or ×) only hides the thread. The ask button reopens it
  when the input is empty and a conversation exists, reading "Resume" rather
  than "Ask" so it isn't a dead control. **This does not hold in Spotter
  mode** — that transcript is inside the iframe and unmounts with the panel.
- **"New chat"** clears the MCP thread via `setMessages([])` and remounts
  Spotter via a local epoch key. That is deliberate over
  `HostEvent.StartNewSpotterConversation`, which needs 26.2.0.cl and does
  nothing at all on older clusters. It does not touch the allowance.
- **Resizable** via native CSS `resize: both` plus a maximize toggle. A corner
  drag writes **inline** width/height which outranks `[data-max="true"]`, so
  the toggle clears those inline values before flipping state, or maximize
  silently does nothing after a drag. The native resizer is near-invisible on
  a light ground, so a `::after` grip is drawn over it with
  `pointer-events: none`.
- **Panel and page are both `--lw-paper`**, so separation comes from a pale
  ring outside the ink border plus a 0.68 scrim, not from the border alone. A
  grey border would be *lower* contrast than what is already there.
- **Answers render raw HTML.** Marginal emits `<iframe>` for visualizations,
  so `MarginalAnswer.tsx` runs `rehype-raw` then `rehype-sanitize` with
  `iframe` added to the default schema. Keep that ordering and the allow-list
  narrow. A message containing an iframe gets a full-width bubble instead of
  `64ch`; the iframe is 560px tall, `72vh` when maximized, and
  `resize: vertical`.

#### MCP answer iframes must go through the SDK

Rendered as-is, ThoughtSpot draws a warning banner **inside** the frame — "MCP
Server iframe URLs require authentication and should not be displayed
directly." That banner is cross-origin; no CSS or JS here can hide it, and
trying is the wrong instinct.

`startAutoMCPFrameRenderer()` (SDK 1.52+, root export) puts a
`MutationObserver` on `document.body`, finds iframes carrying `tsmcp=true`, and
replaces each in-place with an authenticated embed. It is started in
`HomeClient`, not `MarginalChat`, because the observer only catches iframes
added *after* it starts — and the chat unmounts when closed, so reopening it
with existing answers would re-add their frames too late for a chat-scoped
observer.

### Design system

`app/globals.css` holds all of it: `--lw-*` custom properties for the palette,
`.lw-*` utility classes, `.lw-card`/`.lw-row`/`.lw-kpis` for the card system,
`.lw-acc-*` for the balances accordion, `.lw-cfg-*`/`.lw-seg`/`.lw-switch` for
`/config`, `.lw-land`/`.lw-ruled`/`.lw-statusbar` for the landing page, and
`.lw-md` for Marginal's rendered markdown. Fonts are three
`next/font/google` families exposed as CSS variables in `app/layout.tsx`.
Components combine those classes with inline `style` for one-off layout,
mirroring how the artboards are authored.

Take colours from the tokens; every hex in `globals.css` appears in the
artboards, and new ones do not belong.

Note the deliberate asymmetry: **naming** is runtime env
(`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SPOTTER_PERSONA_NAME`) so the app can
be repointed at another prospect with an env edit plus a rebuild, while
**colour** is design tokens, because the palette *is* the LedgerWise design.

### Embed branding: three separate mechanisms

All in `lib/embedBranding.ts`, applied at `init()` unless noted.

**Theme** — `EMBED_CSS_VARIABLES` is a Theme Builder export (Develop →
Customizations → Theme Builder), pasted verbatim. **Regenerate the whole block
there rather than hand-editing a value**, or the file drifts from what the tool
produces and the next export silently reverts the fix. Two accepted gaps: the
fonts it names are Canela / IvyPresto / Inter, which this app does not use at
all — set `NEXT_PUBLIC_EMBED_CSS_URL` and rename them to the real families,
per *Fonts* below), and its palette
is near but not equal to the `--lw-*` tokens — `#F3F0E9 / #171412 / #1E4ED8`
against `#F2EFE7 / #14120F / #1B1AE0`. The grounds are imperceptibly apart; the
blues are not.

**Never send `customCSS.variables` and `customCSSUrl` together.** The SDK
forwards both to the iframe rather than choosing, and variables delivered
through `customCSS` override the stylesheet's `:root` block — so the hosted
file loads correctly and not one of its values takes effect. The failure is
silent: no console error, nothing in the network tab, the theme simply does
not change, and it looks exactly like a CSP problem. `embedBranding.ts`
therefore sends `variables` **only when the URL is unset**, which makes the
object in that file a deliberately stale fallback: it still names Canela and
Inter and still sets uppercase, and it should stay that way.

**Fonts** — the iframe loads a stylesheet hosted in
`jhegele-ts/industry-demos-assets` under `finance-banking/styles.css`, via
jsDelivr on `@main`. **It is deliberately not copied into this repo**, which
is the convention every industry demo follows (compare Forepost's
`TS_CUSTOM_CSS_URL`): one CSP origin covers every demo on every cluster and
every SE's tunnel, and the theme changes without a redeploy. Serving it from
the app instead was tried and reverted — it broke that consistency to solve a
drift problem that only existed because a second copy was being kept.
**Shipping a change to a jsDelivr asset takes TWO steps, in this order.**
There are two independent caches and each needs a different fix; doing them
backwards wastes the version marker. Both assets are affected — the
stylesheet and the icon sprite.

1. **Purge the CDN.** `@main` is cached at the edge for 12 hours
   (`s-maxage=43200`), and a query string does **not** bypass it — jsDelivr
   ignores the query and serves what it has. Hit
   `https://purge.jsdelivr.net/gh/jhegele-ts/industry-demos-assets@main/finance-banking/<file>`
   and `curl` the real URL to confirm the bytes changed.
2. **Then bump the `?v=`.** Browsers are told `max-age=604800`, so anyone who
   loaded the old file keeps it for **seven days** and purging does nothing
   about that. A new query string is a URL nobody has cached.

Bump *after* purging. Bump first and the browser caches the OLD bytes under
the NEW marker, which burns that number and looks exactly like the purge
having failed. This has cost over an hour across two assets. `NEXT_PUBLIC_EMBED_CSS_URL`
overrides the default, which is the fast way to iterate locally. It
exists because `next/font` injects `@font-face` into the host document only,
and a cross-origin iframe inherits none of it — so every family the theme
names falls back, which is why the AI insight tile rendered in Times New
Roman. **Loading a typeface is the one branding job a Theme Builder variable
cannot do; keep that file to that** and leave colours, font names, sizes and
text-transform in the variables, or the same value gets two homes and the
next export disagrees with the file. All three families are Google Fonts
(Instrument Serif, Archivo, IBM Plex Mono), so it is one `@import` and no
font hosting. The cluster's CSP must allow the file's origin plus
`fonts.googleapis.com` and `fonts.gstatic.com`; blocked, it fails silently and
the symptom is "nothing changed".

**Icon sprite** — `NEXT_PUBLIC_ICON_SPRITE_URL` overrides `rd-icon-spotter`,
the ID covering both the Liveboard's Spotter launch and `SpotterEmbed`.
Candidates live in `public/icons/`; the one in use is hosted in
`jhegele-ts/industry-demos-assets` under `finance-banking/spotter-icon.svg`.
They use `fill="currentColor"` rather than the docs' hardcoded black, so the
icon survives on light and dark grounds. `@main` on jsDelivr caches hard —
pin a commit SHA when iterating.

**Chat response cards** — `BRAND_CHAT_CONFIG`, passed as `spotterChatConfig`
to **both** `SpotterEmbed` and `LiveboardEmbed` (the latter accepts it too, and
`updatedSpotterChatPrompt` means Spotter can launch from a viz). The flag reads
backwards: `hideToolResponseCardBranding: true` **hides** the logo. The label
is independent — `toolResponseCardBrandingLabel` replaces the text prefix, `''`
removes it. Neither reaches cards produced by an *external* MCP tool.

`thoughtSpotCustomizations` also hides the liveboard's own header, tab strip
and filter bar, since the app supplies all three itself.

## Traps that have already cost time

- **The AI insight tile's text cannot be reached from this app — don't try
  again.** The Balances tab carries an `ai_tile` (`Viz_27`) whose narrative
  ends with "Research — dig deeper with these queries". Making those questions
  clickable looks easy and is not possible. The text is generated at runtime
  *inside the iframe*: decode its `analysis_code` (gzip + base64) and there is
  no Research block, only pandas printing a stats report. And a selection made
  inside a cross-origin iframe is invisible to the host — `getSelection()`
  returns only the host document, `selectionchange` doesn't cross the
  boundary, mouse events inside a frame don't bubble out, and
  `contentDocument` throws. **That is a browser rule, not an SDK gap**: none
  of the ~130 `EmbedEvent`s carries selected text, and React has no
  privileged access. Two capture routes exist and both were rejected:
  exporting the tab to PDF and mining the text layer, and
  `EmbedEvent.ApiIntercept` with `interceptUrls` — which can hold the tile's
  own generation request, let you replay it yourself and hand the same body
  back (`execute: false`), giving you the real text. That second one works but
  puts a hand-rolled proxy on an undocumented internal endpoint in the tile's
  render path, blocks its render on your round trip (30s `interceptTimeout`),
  and misses anything not sent over `fetch`. `InterceptedApiType` has no
  AI/insight group, so it means `ALL` or a hardcoded URL.
  **Making the tile itself the interaction surface** needs a custom action,
  the only mechanism that does — and a *code-based* one needs no cluster
  configuration at all. It goes in the SDK view config (`customActions`, SDK
  1.43.0+ / ThoughtSpot 10.14.0.cl+) and scopes to this tile alone with
  `metadataIds: { vizIds: ['27616513-…'] }`, `target: VIZ`, `position:
  CONTEXTMENU`. It works, but it cannot carry *which question*:
  `CustomActionPayload` has no field for rendered text, and code-based actions
  on Liveboards are documented as returning no viz data in their callback at
  all. So the action can say "this tile" and never "this question", which is
  why it was dropped rather than built. Note also that a UI-configured action
  sharing an id suppresses the code-based one.
  `AIApi.getRelevantQuestions` will generate *equivalent* questions as
  structured JSON, but the tile generates different ones per region, so they
  render as a second, conflicting Research list rather than a mirror. Hiding
  the tile to avoid that needs `visibleVizs`, which is an allowlist — you'd
  enumerate every other viz by GUID and keep it in sync. This was built and
  reverted (`d3cd8ab`); read that commit before proposing it again.
  **The settled answer is that the user copies the question and pastes it
  into Spotter, launched from the viz** — no app UI at all, since the Cmd-C
  is irreducible either way and an in-app paste bar only changes which
  assistant replies. A bar that routed to Marginal instead was also built and
  reverted (`52dc187`). This is why `RegionLiveboard` passes
  `updatedSpotterChatPrompt` and `spotterChatConfig`: on `/balances` that
  Spotter *is* the feature, so it has to be branded. Don't strip them.

- **A key assigned twice in `.env.local` keeps the LAST one.** dotenv parses
  top to bottom into one object, so an empty stub near the bottom silently
  blanks a real value set higher up, and the only symptom is the feature
  quietly not working. `node -e "require('@next/env').loadEnvConfig(process.cwd())"`
  then printing the key resolves it exactly as Next does — faster than
  reasoning about precedence.
- **`NEXT_PUBLIC_FOO=` with no value inlines as `""`, not `undefined`.** So
  `process.env.FOO ?? fallback` returns `""` and silently wins, because `??`
  only falls through on nullish. Use `||`, or normalise empty to `undefined`.
  This greyed out every filter chip while the resolver underneath worked.
- **Through a tunnel, sign-in fails silently unless the host is allowlisted
  twice.** Server Actions compare `Origin` against `Host`/`X-Forwarded-Host`
  and abort on a mismatch; ngrok rewrites `Host`, so sign-in — a Server Action
  — is rejected with nothing useful in the browser. Separately, dev assets and
  the HMR socket are blocked cross-origin, which makes the dev client force
  reloads that interrupt a submit. `next.config.ts` sets both
  `allowedDevOrigins` and `experimental.serverActions.allowedOrigins`. The
  failing HMR socket is the visible symptom, not the cause.
- **The SpotterCode MCP tool talks to a *different* cluster** than
  `thoughtspotpmm`, and that one is usually asleep. A sleeping instance
  returns an HTML "Start Instance" page with HTTP **200**, so it looks like
  success until you notice the body isn't JSON. Conclude nothing about this
  app's cluster from that tool.
- **Next 404s any `app/` folder starting with `_`** — the private-folder
  convention. Name throwaway routes `dev-preview`.
- **Aggregated measures come back renamed** from searchdata, so a bare column
  name reads as zero rather than erroring.

## Known placeholder content

`lib/demoCopy.ts` holds the role and institution strings the header and Home
greeting show (`Reporting analyst`, `Northbay Financial · 0412`), taken from
the artboards — JIT sign-in is gone, and there is no per-user role to read.

**Filings and Lineage in the header nav are inert** (`href: null`, rendered as
spans). The artboard draws five nav items but only three have pages. They
previously pointed at `#anchors` on `/home`, which meant clicking one from
`/analytics` or `/balances` navigated away from whatever was being shown —
don't restore the hrefs.

The exceptions list, filing calendar, activity feed and landing-page
statistics are hardcoded. The liveboard, its data, Spotter answers, the region
list and auth are real.

**The data is retail deposit and customer analytics** — balances, growth,
credit scores, demographics, products, regions. There is no regulatory data
behind the regulatory dressing: no HMDA fields, no FFIEC line items, not even
an institution dimension. Fine where it is static; **anything live must only
ask what the model can answer**.

Everything that invites a question has been rewritten for this: the seed
prompts, Marginal's follow-up chips, its composer placeholder and the ask
panel's subhead on `/home`. They previously named institutions, filings and
lineage, so two of three chips failed live and the placeholder actively told
the user to ask for a thing that does not exist. Keep any new copy inside the
column list above — the static dressing (filing calendar, activity feed) can
keep its regulatory flavour precisely because nothing there is queryable.

## ThoughtSpot-side requirements

Cluster-side, not fixable from application code:

- The signed-in user needs view access to the liveboard and query access to
  the model.
- The serving origin must be on the cluster's **CSP visual-embed-host** and
  **CORS** allowlists — `localhost:3000` *and* the ngrok domain when
  tunnelling, or the iframe stays blank with only a console error. These are
  **per-org**; check the org the token lands in, not Primary.
- **A sign-in error with no clear cause: read the SERVER log, not the
  console.** The browser gets one generic message because an unknown
  username, a sleeping instance and a rejected secret all land in the same
  catch. The terminal names which:
  - `403` / `code: 10003` / `"Service Secret code is not valid"` —
    `TS_SECRET_KEY` no longer matches the cluster. The trusted-auth secret was
    almost certainly rotated in Develop > Customizations > Security, which
    invalidates every copy instantly and explains "it worked last night".
    **This breaks far more than login**: the same token backs the liveboard
    embeds and the Marginal MCP calls, so `/analytics`, `/balances` and the
    assistant all fail at once and look like three unrelated outages. It also
    breaks every other industry demo pointed at that cluster.
  - HTML instead of JSON — the instance is asleep. Open the host in a
    browser and wait for it.

## Other agent configs

A Gemini CLI config exists at `~/.gemini/settings.json`. To import anything
from it, reply `/import` to scan and list what's importable, then
`/import --yes=<digest>` to apply user-level items.
