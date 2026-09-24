"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import RegionLiveboard from "@/components/RegionLiveboard";
import RetentionFlagDialog, { type FlagRequest } from "@/components/RetentionFlagDialog";
import type { ClickedPoint } from "@/lib/customActions";
import { EMBED_CONFIGURED } from "@/lib/embedInit";
import { LIVEBOARD_ID } from "@/lib/boards";
import type { RegionBalance } from "@/lib/balances";
import type { CurrentUser } from "@/lib/thoughtspot-user";

/** Compact currency: $1.08B / $962.1M / $84.2K. */
function money(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const count = new Intl.NumberFormat("en-US");

/** Deposit types in the order they stack, lightest to heaviest. IRA is last
 *  and darkest on purpose: it is roughly two thirds of this book, and the
 *  point of the bar is that you see that before reading a single figure. */
const MIX = [
  { key: "checking", label: "Checking", tint: "var(--lw-blue-lt)" },
  { key: "savings", label: "Savings", tint: "var(--lw-blue)" },
  { key: "ira", label: "IRA", tint: "var(--lw-ink)" },
] as const;

const total = (r: RegionBalance) => r.savings + r.checking + r.ira;

/** Stacked deposit mix. `scale` is the row's total as a fraction of the
 *  largest region's, so the biggest bar fills the track and the rest are
 *  visibly shorter — the proportion the raw figures hide. */
function MixBar({ row, scale }: { row: RegionBalance; scale: number }) {
  const sum = total(row);
  if (sum <= 0) return null;
  return (
    <span className="lw-mix" aria-hidden>
      <span className="lw-mix-track">
        <span className="lw-mix-fill" style={{ width: `${Math.max(2, scale * 100)}%` }}>
          {MIX.map((part) => (
            <span
              key={part.key}
              className="lw-mix-seg"
              style={{ width: `${(row[part.key] / sum) * 100}%`, background: part.tint }}
            />
          ))}
        </span>
      </span>
    </span>
  );
}

function Metric({ label, value, quiet }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div style={{ textAlign: "right", minWidth: 0 }}>
      <div className="lw-mono" style={{ color: "var(--lw-muted)", whiteSpace: "nowrap" }}>{label}</div>
      <div
        className="lw-serif"
        style={{
          fontSize: quiet ? 17 : 22,
          lineHeight: 1.1,
          marginTop: 4,
          letterSpacing: "-0.01em",
          color: quiet ? "var(--lw-muted)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BalancesClient({
  user,
  rows,
  error,
}: {
  user: CurrentUser;
  rows: RegionBalance[];
  error: string | null;
}) {
  const router = useRouter();
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  // The flag dialog. `flagEpoch` keys it so each opening remounts with fresh
  // state -- resetting in an effect instead trips react-hooks/set-state-in-effect.
  const [flagRequest, setFlagRequest] = useState<FlagRequest | null>(null);
  const [flagEpoch, setFlagEpoch] = useState(0);

  // Stable identity: RegionLiveboard passes this straight into an embed
  // listener, which the SDK compares by reference.
  const onFlag = useCallback((region: string, point: ClickedPoint | null) => {
    setFlagRequest({ region, point });
    setFlagEpoch((n) => n + 1);
  }, []);
  const closeFlag = useCallback(() => setFlagRequest(null), []);

  const canEmbed = EMBED_CONFIGURED && Boolean(LIVEBOARD_ID);
  const totalSavings = rows.reduce((sum, r) => sum + r.savings, 0);
  const totalChecking = rows.reduce((sum, r) => sum + r.checking, 0);
  const totalIra = rows.reduce((sum, r) => sum + r.ira, 0);
  const totalCustomers = rows.reduce((sum, r) => sum + r.customers, 0);
  const grandTotal = totalSavings + totalChecking + totalIra;
  // Bars are scaled against the biggest region, not the platform, so the
  // track is actually used — five bars at 13-31% would all look the same.
  const largest = rows.reduce((max, r) => Math.max(max, total(r)), 0);

  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <AppHeader user={user} active="balances" />

      <main className="lw-home">
        <div className="lw-home-greeting">
          <div style={{ minWidth: 0 }}>
            <h1 className="lw-serif" style={{ fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1, margin: 0 }}>
              Balances
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--lw-muted)", textWrap: "pretty" }}>
              Deposit balances by customer region — select a region to open its dashboard.
            </p>
          </div>
          <button
            type="button"
            className="lw-btn lw-btn-outline"
            style={{ fontSize: 12, padding: "12px 18px" }}
            disabled={isRefreshing}
            // The rows are fetched in the server component, so re-running it
            // is the refresh. useTransition keeps the current rows on screen
            // while it happens instead of blanking the list.
            onClick={() => startRefresh(() => router.refresh())}
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="lw-card"
            style={{ padding: "16px 20px", background: "var(--lw-err-bg)", borderColor: "var(--lw-orange)", color: "var(--lw-err-ink)", fontSize: 14, lineHeight: 1.6 }}
          >
            {error}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="lw-card">
            <div className="lw-card-head lw-card-head-ink">
              <h2 className="lw-card-title lw-serif">Platform total</h2>
              {/* --lw-muted is the mono label colour for paper; --lw-muted-2
                  is the same role on ink. Inline because an inline style
                  would otherwise beat the class. */}
              <span className="lw-mono" style={{ color: "var(--lw-muted-2)" }}>{rows.length} regions</span>
            </div>
            <div className="lw-kpis">
              <div className="lw-kpi">
                <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>Savings balance</div>
                <div className="lw-serif" style={{ fontSize: "clamp(28px, 2.4vw, 34px)", lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>{money(totalSavings)}</div>
              </div>
              <div className="lw-kpi">
                <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>Checking balance</div>
                <div className="lw-serif" style={{ fontSize: "clamp(28px, 2.4vw, 34px)", lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>{money(totalChecking)}</div>
              </div>
              <div className="lw-kpi">
                <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>IRA balance</div>
                <div className="lw-serif" style={{ fontSize: "clamp(28px, 2.4vw, 34px)", lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>{money(totalIra)}</div>
              </div>
              <div className="lw-kpi">
                <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>Customers</div>
                <div className="lw-serif" style={{ fontSize: "clamp(28px, 2.4vw, 34px)", lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>
                  {count.format(totalCustomers)}
                </div>
              </div>
            </div>

            {/* The whole argument of the demo, before anyone clicks: two
                thirds of this book is retirement money. */}
            {grandTotal > 0 ? (
              <div className="lw-mix-summary">
                <span className="lw-mix-track">
                  <span className="lw-mix-fill" style={{ width: "100%" }}>
                    {MIX.map((part) => {
                      const value = part.key === "checking" ? totalChecking : part.key === "savings" ? totalSavings : totalIra;
                      return (
                        <span key={part.key} className="lw-mix-seg" style={{ width: `${(value / grandTotal) * 100}%`, background: part.tint }} />
                      );
                    })}
                  </span>
                </span>
                <span className="lw-mix-legend lw-mono">
                  {MIX.map((part) => {
                    const value = part.key === "checking" ? totalChecking : part.key === "savings" ? totalSavings : totalIra;
                    return (
                      <span key={part.key}>
                        <span className="lw-mix-dot" style={{ background: part.tint }} />
                        {part.label} {Math.round((value / grandTotal) * 100)}%
                      </span>
                    );
                  })}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="lw-acc">
          {rows.map((row) => {
            const isOpen = openRegion === row.region;
            return (
              <section key={row.region} className="lw-acc-item" data-open={isOpen}>
                <button
                  type="button"
                  className="lw-acc-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenRegion(isOpen ? null : row.region)}
                >
                  <span className="lw-acc-mark" aria-hidden>
                    {/* Three ascending bars — the LedgerWise mark, scaled down */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="9" width="3" height="6" rx="1" />
                      <rect x="6.5" y="5" width="3" height="10" rx="1" />
                      <rect x="12" y="1" width="3" height="14" rx="1" />
                    </svg>
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 17, lineHeight: 1.25 }}>{row.region}</span>
                    <span className="lw-mono" style={{ display: "block", color: "var(--lw-muted)", marginTop: 4 }}>
                      {count.format(row.customers)} customers
                    </span>
                  </span>

                  <span className="lw-acc-metrics">
                    <Metric label="Checking" value={money(row.checking)} />
                    <Metric label="Savings" value={money(row.savings)} />
                    <Metric label="IRA" value={money(row.ira)} />
                    {/* Derived, not queried. Raw totals mostly track
                        headcount; per-customer is what separates regions. */}
                    <Metric
                      label="Per customer"
                      value={row.customers > 0 ? money(total(row) / row.customers) : "—"}
                      quiet
                    />
                  </span>

                  <span className="lw-mono" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lw-blue)", whiteSpace: "nowrap" }}>
                    {isOpen ? "Hide" : "View insights"}
                    <span className="lw-acc-chev" aria-hidden>›</span>
                  </span>

                  <span className="lw-acc-barrow">
                    <MixBar row={row} scale={largest > 0 ? total(row) / largest : 0} />
                    <span className="lw-mono lw-acc-share">
                      {money(total(row))} · {grandTotal > 0 ? Math.round((total(row) / grandTotal) * 100) : 0}% of platform
                    </span>
                  </span>
                </button>

                {isOpen ? (
                  <div className="lw-acc-panel">
                    {canEmbed ? (
                      // key: a clean remount per region rather than a
                      // view-config change on a live embed.
                      <RegionLiveboard key={row.region} region={row.region} onFlag={onFlag} />
                    ) : (
                      <p className="lw-mono" style={{ color: "var(--lw-muted)", textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.7, margin: 0 }}>
                        Set NEXT_PUBLIC_TS_HOST and NEXT_PUBLIC_LIVEBOARD_ID in .env.local to embed
                        the {row.region} dashboard here, filtered to this region.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {rows.length === 0 && !error ? (
          <div className="lw-card" style={{ padding: "22px 20px" }}>
            <p style={{ margin: 0, fontSize: 15, color: "var(--lw-muted)" }}>
              No regions came back from the query.
            </p>
          </div>
        ) : null}
      </main>

      <AppFooter />

      <RetentionFlagDialog key={flagEpoch} request={flagRequest} onClose={closeFlag} />
    </div>
  );
}
