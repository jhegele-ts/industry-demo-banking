"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { HostEvent } from "@thoughtspot/visual-embed-sdk";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import LiveboardEmbedView, { type LiveboardRef } from "@/components/LiveboardEmbedView";
import LiveboardPlaceholder from "@/components/LiveboardPlaceholder";
import { BOARD_TABS, LIVEBOARD_ID } from "@/lib/boards";
import type { ResolvedFilter } from "@/lib/filterColumns";
import { SPOTTER_PERSONA_NAME } from "@/lib/embedBranding";
import { EMBED_CONFIGURED } from "@/lib/embedInit";
import type { CurrentUser } from "@/lib/thoughtspot-user";

/* Side panels lifted from the "LedgerWise Analytics" artboard. */

const PINNED = [
  { name: "Savings balance", value: "$1.08B", tint: "var(--lw-blue)" },
  { name: "Checking balance", value: "$962.1M", tint: "var(--lw-blue)" },
  { name: "Customers", value: "200K", tint: "var(--lw-blue)" },
  { name: "Avg. credit score", value: "683.8", tint: "var(--lw-orange)" },
];

const DELIVERY = [
  { who: "Regulatory ops distro", cadence: "daily 06:00" },
  { who: "Northbay exec team", cadence: "monthly" },
  { who: "Examiner packet", cadence: "quarterly" },
];

export default function AnalyticsClient({
  user,
  filters,
  extract,
}: {
  user: CurrentUser;
  /** Resolved server-side: column name -> GUID, which OpenFilter requires. */
  filters: ResolvedFilter[];
  /** Likewise — "02:14 UTC · Sep 23 2026". A date computed in a client
   *  component disagrees with itself across hydration. */
  extract: string;
}) {
  // Built here rather than at module scope so the extract stamp can be
  // today's. This is rendered content, not embed view config, so a new array
  // per render is free — the stable-identity rule applies to embed props.
  const LINEAGE = [
    { step: "Source", detail: "NUCLEUS · DDA_BAL_HIST" },
    { step: "Join", detail: "CUST_DIM on acct_key" },
    { step: "Extract", detail: extract },
    { step: "Tie-out", detail: "Trial balance 1.a · 0.00% variance" },
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const liveboardRef = useRef<LiveboardRef>(null);

  const board = BOARD_TABS[activeIndex];
  const canEmbed = EMBED_CONFIGURED && Boolean(LIVEBOARD_ID);
  const missingVar = !EMBED_CONFIGURED ? "NEXT_PUBLIC_TS_HOST" : "NEXT_PUBLIC_LIVEBOARD_ID";

  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <AppHeader user={user} active="analytics" />

      <main
        id="analytics"
        style={{
          padding: "clamp(22px, 3.4vw, 40px) clamp(14px, 4vw, 56px) clamp(30px, 4vw, 56px)",
          maxWidth: 1480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(18px, 2.4vw, 28px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div className="lw-mono lw-mono-sm" style={{ display: "flex", alignItems: "center", gap: 10, letterSpacing: "0.14em", color: "var(--lw-muted)" }}>
              <span className="lw-blink" style={{ width: 8, height: 8, background: "var(--lw-orange)", borderRadius: "50%" }} />
              Live data
            </div>
            <h1 className="lw-serif" style={{ fontSize: "clamp(32px, 4.6vw, 58px)", lineHeight: 1, margin: "12px 0 0" }}>{board.name}</h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="lw-btn lw-btn-primary"
              style={{ fontSize: 12, padding: "13px 20px" }}
              onClick={() => liveboardRef.current?.trigger(HostEvent.AIHighlights)}
              disabled={!canEmbed}
            >
              {SPOTTER_PERSONA_NAME} highlights
            </button>
            <button
              type="button"
              className="lw-btn lw-btn-outline"
              style={{ fontSize: 12, padding: "13px 20px" }}
              onClick={() => liveboardRef.current?.trigger(HostEvent.DownloadAsPdf)}
              disabled={!canEmbed}
            >
              Export
            </button>
            <Link href="/home" className="lw-btn lw-btn-outline" style={{ fontSize: 12, padding: "13px 20px" }}>
              Ask {SPOTTER_PERSONA_NAME}
            </Link>
          </div>
        </div>

        {/* --- board tabs: SetActiveTab, never a prop change -------------- */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1.5px solid var(--lw-ink)", paddingBottom: 14 }}>
          {BOARD_TABS.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={index === activeIndex}
              title={tab.tabId ? undefined : `Set NEXT_PUBLIC_TAB_ID_${tab.key.toUpperCase()} to switch to this tab`}
              onClick={() => {
                setActiveIndex(index);
                if (tab.tabId) {
                  liveboardRef.current?.trigger(HostEvent.SetActiveTab, { tabId: tab.tabId });
                }
              }}
              className="lw-mono lw-mono-sm"
              style={{
                letterSpacing: "0.06em",
                background: index === activeIndex ? "var(--lw-ink)" : "var(--lw-paper)",
                color: index === activeIndex ? "var(--lw-paper)" : "var(--lw-ink)",
                border: "1.5px solid var(--lw-ink)", borderRadius: 6, padding: "10px 14px", cursor: "pointer",
                opacity: tab.tabId || !canEmbed ? 1 : 0.55,
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* --- filters: open the embedded board's own filter UI ----------- */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>Filters</span>
          {filters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              disabled={!canEmbed || !filter.columnId}
              title={
                filter.columnId
                  ? `Open the ${filter.column} filter`
                  : `Could not resolve a column GUID for "${filter.column}" — set NEXT_PUBLIC_FILTER_COL_* to override`
              }
              onClick={() =>
                liveboardRef.current?.trigger(HostEvent.OpenFilter, {
                  column: { columnId: filter.columnId },
                })
              }
              className="lw-mono lw-mono-sm"
              style={{
                display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.04em",
                border: "1.5px solid var(--lw-ink)", borderRadius: 6, background: "var(--lw-paper-2)",
                padding: "9px 12px", color: "var(--lw-ink)",
                cursor: canEmbed && filter.columnId ? "pointer" : "not-allowed",
                opacity: canEmbed && filter.columnId ? 1 : 0.55,
              }}
            >
              <span style={{ color: "var(--lw-muted)" }}>{filter.label}</span>
              <span style={{ color: "var(--lw-muted)" }}>▾</span>
            </button>
          ))}
          <button
            type="button"
            disabled={!canEmbed}
            // There is no "reset filters" host event -- ResetLiveboard is an
            // EmbedEvent the embed emits, not a command you send. But
            // UpdateRuntimeFilters resets the liveboard to its original saved
            // state and then applies exactly what is passed, so passing an
            // empty list is the documented way to clear back to default.
            onClick={() => liveboardRef.current?.trigger(HostEvent.UpdateRuntimeFilters, [])}
            className="lw-mono"
            style={{ background: "transparent", border: "none", color: "var(--lw-blue)", cursor: "pointer", letterSpacing: "0.1em" }}
          >
            Reset
          </button>
        </div>

        {/* --- the embed -------------------------------------------------- */}
        <div style={{ border: "1.5px solid var(--lw-ink)", borderRadius: 10, overflow: "hidden", background: "var(--lw-paper)" }}>
          <div
            className="lw-mono"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              background: "var(--lw-ink)", color: "var(--lw-paper)", padding: "12px 16px", letterSpacing: "0.14em",
            }}
          >
            <span>{board.name} · {canEmbed ? "live" : "not configured"}</span>
            <span style={{ color: "var(--lw-muted-2)", letterSpacing: "0.12em", textTransform: "none" }}>
              {LIVEBOARD_ID || board.key}
            </span>
          </div>

          {canEmbed ? (
            <LiveboardEmbedView
              ref={liveboardRef}
              liveboardId={LIVEBOARD_ID}
              initialTabId={BOARD_TABS[0].tabId || undefined}
            />
          ) : (
            <LiveboardPlaceholder envVar={missingVar} />
          )}
        </div>

        {/* --- side panels ------------------------------------------------ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(14px, 2vw, 22px)" }}>
          <div style={{ border: "1.5px solid var(--lw-ink)", borderRadius: 8, overflow: "hidden" }}>
            <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)", padding: "13px 16px", borderBottom: "1px solid var(--lw-rule)" }}>Pinned answers</div>
            {PINNED.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: "12px 16px", borderBottom: "1px solid var(--lw-rule)" }}>
                <span style={{ fontSize: 14, minWidth: 0 }}>{p.name}</span>
                <span className="lw-mono" style={{ fontSize: 12, color: p.tint, whiteSpace: "nowrap", letterSpacing: 0, textTransform: "none" }}>{p.value}</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1.5px solid var(--lw-ink)", borderRadius: 8, overflow: "hidden", background: "var(--lw-paper-2)" }}>
            <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)", padding: "13px 16px", borderBottom: "1px solid var(--lw-rule)" }}>Delivery</div>
            {DELIVERY.map((d) => (
              <div key={d.who} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: "12px 16px", borderBottom: "1px solid var(--lw-rule)" }}>
                <span style={{ fontSize: 14, minWidth: 0 }}>{d.who}</span>
                <span className="lw-mono" style={{ letterSpacing: "0.1em", color: "var(--lw-muted)" }}>{d.cadence}</span>
              </div>
            ))}
          </div>

          <div style={{ border: "1.5px solid var(--lw-ink)", borderRadius: 8, overflow: "hidden" }}>
            <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)", padding: "13px 16px", borderBottom: "1px solid var(--lw-rule)" }}>Data lineage</div>
            {LINEAGE.map((l) => (
              <div key={l.step} style={{ display: "grid", gridTemplateColumns: "76px minmax(0, 1fr)", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--lw-rule)" }}>
                <span className="lw-mono" style={{ letterSpacing: "0.08em", color: "var(--lw-orange)" }}>{l.step}</span>
                <span className="lw-mono" style={{ fontSize: 12, minWidth: 0, wordBreak: "break-word", letterSpacing: 0, textTransform: "none" }}>{l.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
