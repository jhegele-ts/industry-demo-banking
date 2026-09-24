import type { CustomisationsInterface } from "@thoughtspot/visual-embed-sdk/react";

// Prospect-specific naming, read at runtime so this same app can be
// repointed at a different prospect with an .env.local edit plus a rebuild.
// NEXT_PUBLIC_* vars are inlined at build time, so an env-only change still
// needs `npm run build` — just not a code edit.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "LedgerWise";
export const SPOTTER_PERSONA_NAME =
  process.env.NEXT_PUBLIC_SPOTTER_PERSONA_NAME || "Marginal";
/**
 * Sprite overriding ThoughtSpot's own icons inside the embed — `rd-icon-spotter`
 * covers both the Liveboard's Spotter launch button and SpotterEmbed.
 *
 * Defaulted rather than env-only, matching EMBED_CSS_URL below and Forepost's
 * TS_ICON_SPRITE_URL: env-only meant a fresh clone silently got ThoughtSpot's
 * icon back on a button labelled "Marginal", with nothing to indicate why.
 *
 * Same cache rule as the stylesheet: purge jsDelivr first, THEN bump `?v=`.
 */
export const ICON_SPRITE_URL =
  process.env.NEXT_PUBLIC_ICON_SPRITE_URL ||
  "https://cdn.jsdelivr.net/gh/jhegele-ts/industry-demos-assets@main/finance-banking/spotter-icon.svg?v=3";

/**
 * Stylesheet the IFRAME loads, so the brand typefaces exist inside it.
 *
 * next/font injects @font-face into the host document only, and a
 * cross-origin iframe inherits none of it — so every font the theme names
 * falls back until the iframe fetches a sheet of its own. Loading a typeface
 * is the one branding job a Theme Builder variable cannot do.
 *
 * HOSTED, AND DELIBERATELY NOT COPIED INTO THIS REPO. Every industry demo
 * keeps its embed stylesheet in `jhegele-ts/industry-demos-assets` under its
 * own folder and points at it through jsDelivr on `@main` — see Forepost's
 * `TS_CUSTOM_CSS_URL`. Matching that matters more than any per-app tidiness:
 * one CSP origin covers every demo on every cluster and every SE's tunnel,
 * and the theme can be changed without redeploying anything.
 *
 * Keeping a second copy in `public/` is what caused this file's worst hour —
 * the hosted copy silently ran a version behind twice. One copy, hosted.
 *
 * `@main` is the family convention, and the `?v=` is what makes it usable.
 * jsDelivr answers with `cache-control: max-age=604800`, so a BROWSER that
 * ever loaded an older copy keeps it for seven days — purging the CDN does
 * nothing about that, and the symptom is one person seeing last week's theme
 * with no error anywhere. A new query string is a URL nobody has cached.
 *
 * ** BUMP `?v=` EVERY TIME styles.css CHANGES. ** It is the whole mechanism;
 * without it a theme change reaches nobody who has already visited.
 *
 * NEXT_PUBLIC_EMBED_CSS_URL overrides it, which is worth keeping for local
 * iteration — point it at a file the app serves and skip the push entirely.
 */
export const EMBED_CSS_URL =
  process.env.NEXT_PUBLIC_EMBED_CSS_URL ||
  "https://cdn.jsdelivr.net/gh/jhegele-ts/industry-demos-assets@main/finance-banking/styles.css?v=3";

// The prefix on Spotter's tool response cards, where ThoughtSpot otherwise
// writes its own name.
export const SPOTTER_CARD_LABEL =
  process.env.NEXT_PUBLIC_SPOTTER_CARD_LABEL || SPOTTER_PERSONA_NAME;

/**
 * Branding for Spotter's tool response cards — the little "T" badge and the
 * "ThoughtSpot" prefix above a generated answer.
 *
 * The two settings are independent, and the flag is easy to get backwards:
 *  - `hideToolResponseCardBranding: true` hides the LOGO/ICON. `false` keeps
 *    it — so true is the value that removes the badge.
 *  - `toolResponseCardBrandingLabel` replaces the TEXT prefix; `''` removes
 *    the prefix entirely.
 *
 * Module scope on purpose: this is passed straight to an embed, and the SDK
 * rebuilds the iframe whenever a prop's identity changes.
 *
 * It does not reach cards produced by an external MCP tool — those carry that
 * tool's own branding, which this cannot override.
 */
export const BRAND_CHAT_CONFIG = {
  hideToolResponseCardBranding: true,
  toolResponseCardBrandingLabel: SPOTTER_CARD_LABEL,
};

/**
 * ThoughtSpot theme variables, applied to every embed at init().
 *
 * Authored in ThoughtSpot's own Theme Builder (Develop → Customizations →
 * Theme Builder) and pasted here verbatim — do not hand-edit individual
 * values to "fix" a colour. Regenerate in Theme Builder and replace the whole
 * block, so this stays a faithful copy of what that tool produces.
 *
 * Two things to know before changing it:
 *
 * 1. The font stacks name Canela, IvyPresto Display and Inter. None of those
 *    are loaded inside the embed's iframe — the host page's next/font faces
 *    do not cross the iframe boundary — so they resolve to the declared
 *    fallbacks (Times New Roman and Helvetica/Arial). Loading them for real
 *    needs `style.customCSSUrl` pointing at a hosted stylesheet with the
 *    @font-face rules.
 * 2. These values are close to, but not identical with, the LedgerWise design
 *    tokens in globals.css (see the note in CLAUDE.md). The blues in
 *    particular differ.
 */
/**
 * THE FALLBACK THEME, used only when NEXT_PUBLIC_EMBED_CSS_URL is unset.
 *
 * `public/embed/ledgerwise-embed.css` carries the same block plus the
 * @import rules that load the fonts, and when that URL is set it is the only
 * source of variables — see the conditional at `customCSS` below for why
 * sending both breaks silently.
 *
 * Which means this copy is deliberately stale: it still names Canela and
 * Inter, and still sets root text-transform to uppercase, because those are
 * the values that were correct before fonts could be loaded into the iframe.
 * Leave it that way. It describes the unthemed-fallback case, and the hosted
 * file is where the real theme lives.
 */
const EMBED_CSS_VARIABLES: Record<string, string> = {
  "--ts-var-root-background": "#F3F0E9",
  "--ts-var-root-color": "#171412",
  "--ts-var-root-font-family": "\"Canela\", \"IvyPresto Display\", \"Times New Roman\", serif",
  "--ts-var-root-text-transform": "uppercase",
  "--ts-var-nav-background": "#0F0B09",
  "--ts-var-nav-color": "#F3F0E9",
  "--ts-var-application-color": "#171412",
  "--ts-var-button-border-radius": "2px",
  "--ts-var-button--icon-border-radius": "2px",
  "--ts-var-button--primary-color": "#FFFFFF",
  "--ts-var-button--primary--font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-button--primary-background": "#1E4ED8",
  "--ts-var-button--primary--hover-background": "#1A43BB",
  "--ts-var-button--primary--active-background": "#15389B",
  "--ts-var-button--secondary-color": "#171412",
  "--ts-var-button--secondary--font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-button--secondary-background": "#ECE7DC",
  "--ts-var-button--secondary--hover-background": "#E1DACB",
  "--ts-var-button--secondary--active-background": "#D5CCBA",
  "--ts-var-button--tertiary-color": "#171412",
  "--ts-var-button--tertiary-background": "#F3F0E9",
  "--ts-var-button--tertiary--hover-background": "#ECE7DC",
  "--ts-var-button--tertiary--active-background": "#E1DACB",
  "--ts-var-viz-title-color": "#171412",
  "--ts-var-viz-title-font-family": "\"Canela\", \"IvyPresto Display\", \"Times New Roman\", serif",
  "--ts-var-viz-title-text-transform": "none",
  "--ts-var-viz-description-color": "#6F675E",
  "--ts-var-viz-description-font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-viz-description-text-transform": "none",
  "--ts-var-viz-border-radius": "4px",
  "--ts-var-viz-box-shadow": "0 1px 2px rgba(23, 20, 18, 0.06)",
  "--ts-var-viz-background": "#FCFBF8",
  "--ts-var-chip-border-radius": "2px",
  "--ts-var-chip-box-shadow": "none",
  "--ts-var-chip-background": "#ECE7DC",
  "--ts-var-chip-color": "#171412",
  "--ts-var-chip--hover-color": "#171412",
  "--ts-var-chip--hover-background": "#E1DACB",
  "--ts-var-chip--active-color": "#FFFFFF",
  "--ts-var-chip--active-background": "#171412",
  "--ts-var-chip-title-font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-axis-title-color": "#4F4842",
  "--ts-var-axis-title-font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-axis-data-label-color": "#6F675E",
  "--ts-var-axis-data-label-font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-menu-color": "#171412",
  "--ts-var-menu-background": "#FCFBF8",
  "--ts-var-menu-font-family": "\"Inter\", \"Helvetica Neue\", Arial, sans-serif",
  "--ts-var-menu-text-transform": "uppercase",
  "--ts-var-menu--hover-background": "#F3F0E9",
  "--ts-var-menu-selected-text-color": "#1E4ED8",
  "--ts-var-dialog-body-background": "#FCFBF8",
  "--ts-var-dialog-body-color": "#171412",
  "--ts-var-dialog-header-background": "#0F0B09",
  "--ts-var-dialog-header-color": "#F3F0E9",
  "--ts-var-dialog-footer-background": "#F3F0E9",
  "--ts-var-list-selected-background": "#ECE7DC",
  "--ts-var-list-hover-background": "#F3F0E9",
  "--ts-var-segment-control-hover-background": "#ECE7DC",
  "--ts-var-checkbox-border-color": "#B8AEA0",
  "--ts-var-checkbox-hover-border": "#171412",
  "--ts-var-checkbox-active-color": "#1E4ED8",
  "--ts-var-checkbox-checked-color": "#1E4ED8",
  "--ts-var-checkbox-checked-disabled": "#B8AEA0",
  "--ts-var-checkbox-background-color": "#FCFBF8",
  "--ts-var-checkbox-error-border": "#B42318",
  "--ts-var-liveboard-layout-background": "#F3F0E9",
  "--ts-var-liveboard-header-background": "#F3F0E9",
  "--ts-var-liveboard-header-font-color": "#171412",
  "--ts-var-liveboard-tile-border-color": "#D9D1C4",
  "--ts-var-liveboard-tile-background": "#FCFBF8",
  "--ts-var-liveboard-insight-tile-font-color": "#171412",
  "--ts-var-liveboard-insight-tile-background": "#FCFBF8",
  "--ts-var-liveboard-insight-tile-icon-color": "#1E4ED8",
  "--ts-var-liveboard-insight-tile-success-color": "#157F3B",
  "--ts-var-liveboard-insight-tile-failure-color": "#B42318",
  "--ts-var-liveboard-tile-border-radius": "4px",
  "--ts-var-liveboard-tile-padding": "12px",
  "--ts-var-liveboard-tile-table-header-background": "#F3F0E9",
  "--ts-var-liveboard-group-padding": "16px",
  "--ts-var-liveboard-group-title-font-size": "20px",
  "--ts-var-liveboard-group-title-font-weight": "500",
  "--ts-var-liveboard-group-tile-title-font-size": "14px",
  "--ts-var-liveboard-group-tile-title-font-weight": "500",
  "--ts-var-liveboard-group-tile-padding": "12px",
  "--ts-var-liveboard-answer-viz-padding": "12px",
  "--ts-var-liveboard-group-background": "#EFE9DE",
  "--ts-var-liveboard-group-border-color": "#D9D1C4",
  "--ts-var-liveboard-notetitle-heading-font-color": "#171412",
  "--ts-var-liveboard-notetitle-body-font-color": "#4F4842",
  "--ts-var-liveboard-group-title-font-color": "#171412",
  "--ts-var-liveboard-group-description-font-color": "#6F675E",
  "--ts-var-liveboard-group-tile-title-font-color": "#171412",
  "--ts-var-liveboard-group-tile-description-font-color": "#6F675E",
  "--ts-var-liveboard-group-tile-background": "#FCFBF8",
  "--ts-var-liveboard-chip-background": "#ECE7DC",
  "--ts-var-liveboard-chip-color": "#171412",
  "--ts-var-liveboard-chip--hover-background": "#E1DACB",
  "--ts-var-liveboard-chip--active-background": "#171412",
  "--ts-var-side-panel-width": "360px",
  "--ts-var-liveboard-edit-bar-background": "#F3F0E9",
  "--ts-var-liveboard-dual-column-breakpoint": "1200px",
  "--ts-var-liveboard-single-column-breakpoint": "768px",
  "--ts-var-liveboard-cross-filter-layout-background": "#F3F0E9",
  "--ts-var-liveboard-tab-active-border-color": "#171412",
  "--ts-var-liveboard-tab-hover-color": "#171412",
  "--ts-var-liveboard-tile-title-fontsize": "16px",
  "--ts-var-liveboard-tile-title-fontweight": "500",
  "--ts-var-parameter-chip-background": "#ECE7DC",
  "--ts-var-parameter-chip-text-color": "#171412",
  "--ts-var-parameter-chip-hover-background": "#E1DACB",
  "--ts-var-parameter-chip-hover-text-color": "#171412",
  "--ts-var-parameter-chip-active-background": "#1E4ED8",
  "--ts-var-parameter-chip-active-text-color": "#FFFFFF",
  "--ts-var-liveboard-header-action-button-background": "#1E4ED8",
  "--ts-var-liveboard-header-action-button-font-color": "#FFFFFF",
  "--ts-var-liveboard-header-action-button-hover-color": "#FFFFFF",
  "--ts-var-liveboard-header-action-button-active-color": "#FFFFFF",
  "--ts-var-liveboard-header-badge-background": "#ECE7DC",
  "--ts-var-liveboard-header-badge-font-color": "#171412",
  "--ts-var-liveboard-header-badge-modified-background": "#1E4ED8",
  "--ts-var-liveboard-header-badge-modified-font-color": "#FFFFFF",
  "--ts-var-liveboard-header-badge-hover-color": "#171412",
  "--ts-var-liveboard-header-badge-active-color": "#171412",
  "--ts-var-kpi-hero-color": "#171412",
  "--ts-var-kpi-comparison-color": "#6F675E",
  "--ts-var-kpi-analyze-text-color": "#1E4ED8",
  "--ts-var-chart-heatmap-legend-title-color": "#171412",
  "--ts-var-chart-heatmap-legend-label-color": "#6F675E",
  "--ts-var-chart-treemap-legend-title-color": "#171412",
  "--ts-var-chart-treemap-legend-label-color": "#6F675E",
  "--ts-var-kpi-positive-change-color": "#157F3B",
  "--ts-var-kpi-negative-change-color": "#B42318",
  "--ts-var-liveboard-styling-panel-text-color": "#171412",
  "--ts-var-liveboard-styling-panel-border-color": "#D9D1C4",
  "--ts-var-liveboard-styling-button-background": "#FCFBF8",
  "--ts-var-liveboard-styling-button-text-color": "#171412",
  "--ts-var-liveboard-styling-button-hover-background": "#F3F0E9",
  "--ts-var-liveboard-styling-button-active-background": "#ECE7DC",
  "--ts-var-liveboard-styling-button-hover-text-color": "#171412",
  "--ts-var-liveboard-styling-button-shadow": "0 1px 2px rgba(23, 20, 18, 0.06)",
  "--ts-var-liveboard-styling-color-palette-background": "#FCFBF8",
  "--ts-var-liveboard-edit-toolbar-border": "#D9D1C4",
  "--ts-var-liveboard-edit-toolbar-selected-background": "#171412",
  "--ts-var-liveboard-edit-toolbar-selected-text-color": "#FFFFFF",
  "--ts-var-liveboard-edit-toolbar-text": "#171412",
  "--ts-var-liveboard-edit-toolbar-hover-background": "#ECE7DC",
  "--ts-var-liveboard-edit-toolbar-hover-text-color": "#171412",
};

/**
 * Applied once at init(), so it covers every embed — /analytics and each
 * per-region liveboard on /balances.
 *
 *  - `variables` is the Theme Builder theme above.
 *  - `content.strings` white-labels "Spotter" wherever ThoughtSpot's own UI
 *    shows it, so a liveboard reads "Marginal" like the rest of the app.
 *  - `rules_UNSTABLE` hides the liveboard's own header, tab strip and filter
 *    bar. This app supplies all three itself, so leaving ThoughtSpot's
 *    visible would duplicate them.
 */
export const thoughtSpotCustomizations: CustomisationsInterface = {
  iconSpriteUrl: ICON_SPRITE_URL,
  content: {
    strings: {
      Spotter: SPOTTER_PERSONA_NAME,
      ThoughtSpot: BRAND_NAME,
    },
  },
  style: {
    // The hosted stylesheet: @import rules that load the typefaces, plus the
    // whole variable block.
    customCSSUrl: EMBED_CSS_URL,
    customCSS: {
      // ONLY when there is no hosted sheet. The SDK forwards `customCSS` and
      // `customCSSUrl` to the iframe together rather than choosing between
      // them, and variables delivered this way OVERRIDE the stylesheet's
      // :root block -- so sending both leaves the hosted file loading
      // correctly while none of its values take effect. That failure is
      // silent: no console error, nothing in the network tab, the theme just
      // does not change.
      ...(EMBED_CSS_URL ? {} : { variables: EMBED_CSS_VARIABLES }),
      rules_UNSTABLE: {
        ".pinboard-header-module__pinboardHeaderContainer": { display: "none !important" },
        ".pinboard-header-module__pinboardHeader": { display: "none !important" },
        ".pinboard-header-module__tabAndFilterWrapper": { display: "none !important" },
      },
    },
  },
};
