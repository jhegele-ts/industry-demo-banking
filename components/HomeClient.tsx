"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { startAutoMCPFrameRenderer } from "@thoughtspot/visual-embed-sdk";
// Side-effect import: runs the guarded init(). /home has no embed view of its
// own, so without this the SDK is never configured on this page and the
// renderer below has nothing to authenticate against.
import { EMBED_CONFIGURED } from "@/lib/embedInit";
import { useHydrated } from "@/lib/useHydrated";
import { useAppConfig } from "@/stores/appConfig";
import { isLimitReached, useMonetization } from "@/stores/monetization";
import { useRetentionFlags } from "@/stores/retentionFlags";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import HotkeyListener from "@/components/HotkeyListener";
import MarginalChat from "@/components/MarginalChat";
import QueryLimitDialog from "@/components/QueryLimitDialog";
import { SPOTTER_PERSONA_NAME } from "@/lib/embedBranding";
import { DEMO_ROLE } from "@/lib/demoCopy";
import type { CurrentUser } from "@/lib/thoughtspot-user";

/* Content lifted from the "LedgerWise Home" artboard; layout deliberately
   quieter than the artboard, at the user's request. */

const EXCEPTIONS = [
  { id: "LN-88217", who: "Riverbend Distribution Bank", text: "HMDA rate spread missing on one originated loan", sev: "critical", tint: "var(--lw-orange)", ink: "var(--lw-orange-dk)" },
  { id: "RC-C 1.e", who: "Harbor Trust", text: "Loan category variance 2.4% vs. trial balance", sev: "critical", tint: "var(--lw-orange)", ink: "var(--lw-orange-dk)" },
  { id: "EXT-0412", who: "Riverbend · retry queued", text: "Nightly extract failed twice", sev: "high", tint: "var(--lw-amber)", ink: "var(--lw-amber-dk)" },
  { id: "5300 §7", who: "Cedar Point CU", text: "Member business loan tie-out pending", sev: "medium", tint: "var(--lw-blue)", ink: "var(--lw-blue)" },
  { id: "APY-334", who: "9 products affected", text: "Reg DD disclosure APY drifted 3bps", sev: "low", tint: "var(--lw-muted-2)", ink: "var(--lw-muted)" },
];

const PULSE = [
  { label: "Savings balance", value: "$1.08B", delta: "+1.7%", tint: "var(--lw-blue)" },
  { label: "Checking balance", value: "$962.1M", delta: "+0.4%", tint: "var(--lw-blue)" },
  { label: "Customers", value: "200K", delta: "+2,140", tint: "var(--lw-blue)" },
  { label: "Avg. credit score", value: "683.8", delta: "−1.2", tint: "var(--lw-orange-dk)" },
  { label: "30+ delinquency", value: "1.94%", delta: "+11 bps", tint: "var(--lw-orange-dk)" },
];

const FILINGS = [
  { due: "4 days", name: "FFIEC 041 Call Report", state: "in review", ink: "var(--lw-orange-dk)" },
  { due: "9 days", name: "NCUA 5300", state: "building", ink: "var(--lw-amber-dk)" },
  { due: "21 days", name: "HMDA LAR submission", state: "6 edits", ink: "var(--lw-blue)" },
  { due: "38 days", name: "FR Y-9C", state: "not started", ink: "var(--lw-muted)" },
];

const ACTIVITY = [
  { time: "02:14 UTC", title: "Overnight build finished", body: "1,412 institutions refreshed across 11 core platforms. No schema drift." },
  { time: "Yesterday 16:40", title: "Q2 restatement published", body: "Harbor Trust RC-C reclass approved by J. Okafor; point-in-time snapshot preserved." },
  { time: "Monday", title: "New connector live", body: "Meridian-9 read-only feed certified for two pilot institutions." },
];

// Seed questions. Every one has to be answerable from the Banking model —
// balances, growth, credit rating, age group, income group, product, region.
// The artboard's originals asked about HMDA edits and institutions, neither of
// which exists in the data, so clicking them made Marginal fail in front of
// whoever was watching.
const PROMPTS = [
  "Savings growth by region and income group",
  "Customer count by credit rating and age group",
  "Average checking and savings balance by region",
];

/** Built from server-resolved strings — see lib/demoClock.ts for why the
 *  date cannot be computed here. */
function statusLine(today: string, closeIn: string, openCount: number): string {
  return `${today} · ${openCount} open exceptions · ${closeIn}`;
}

/** Compact currency, matching /balances. */
function flagMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function HomeClient({
  user,
  greeting,
  today,
  closeIn,
}: {
  user: CurrentUser;
  /** Resolved on the server so the markup matches on hydration. */
  greeting: string;
  /** Likewise — "Wednesday, September 23". */
  today: string;
  /** Likewise — "close in 7 days". */
  closeIn: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>();
  const [upsellOpen, setUpsellOpen] = useState(false);

  // Gating state for the ask panel. Hydration-gated so the server render and
  // the first client render agree; until then the panel behaves as unlimited.
  const hydrated = useHydrated();

  // Flags raised from the liveboard on /balances, shown above the static
  // exceptions. Hydration-gated: this reads localStorage, so the server
  // render has none and the first client render must agree.
  const rawFlags = useRetentionFlags((s) => s.flags);
  const flags = hydrated ? rawFlags : [];

  const enableGating = useMonetization((s) => s.enableGating);
  const consumedQueries = useMonetization((s) => s.consumedQueries);
  const totalQueries = useMonetization((s) => s.totalQueries);

  // Streams from /api/marginal, which drives ThoughtSpot's Spotter MCP
  // session protocol with Claude orchestrating the tool loop.
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/marginal" }),
  });
  const isBusy = status === "submitted" || status === "streaming";

  // Same rule as the chat panel: the allowance is spent immediately, but the
  // blocked state waits until the answer in flight has landed. Declared after
  // useChat because it reads isBusy.
  const limitReached =
    hydrated &&
    !isBusy &&
    isLimitReached({ enableGating, consumedQueries, totalQueries });

  // Marginal answers carry raw <iframe src="...tsmcp=true..."> markup. Shown
  // as-is, ThoughtSpot renders a warning banner inside the frame telling you
  // to use the SDK. This watches the DOM for those frames and replaces each
  // in-place with a properly authenticated embed, which is that remedy.
  //
  // Mounted here rather than inside MarginalChat because the observer only
  // catches iframes *added* after it starts: the chat unmounts when closed,
  // so reopening it with existing answers would re-add their frames before a
  // chat-scoped observer could start. This one outlives that.
  useEffect(() => {
    if (!EMBED_CONFIGURED) return;
    const observer = startAutoMCPFrameRenderer();
    return () => observer.disconnect();
  }, []);

  const ask = useCallback(
    (question: string) => {
      setDraft("");
      setOpen(true);

      // Read at call time rather than subscribing: this must see the state as
      // it is on this click, including a consumeQuery() from the message just
      // before it, not a value captured when the callback was created.
      const money = useMonetization.getState();
      if (isLimitReached(money)) return; // the modal shows why

      // Spotter mode: the embed has its own composer, so hand the question
      // over as its opening query and let it count the ask itself, through
      // onSpotterQueryTriggered. Consuming here as well would double-count.
      if (useAppConfig.getState().agentExperience === "spotter") {
        setInitialQuery(question);
        return;
      }

      if (money.enableGating) money.consumeQuery();

      sendMessage({ text: question });
    },
    [sendMessage],
  );
  const closeChat = useCallback(() => setOpen(false), []);

  // Clears the thread without closing the panel. The pending Spotter query is
  // cleared too, or remounting that embed would reopen the old question.
  const newChat = useCallback(() => {
    setMessages([]);
    setInitialQuery(undefined);
  }, [setMessages]);

  // Closing the panel (outside click or ×) only hides it — the conversation
  // lives on in `messages` here, on the parent. Without this the only route
  // back was asking a fresh question, which threw the thread away.
  const hasConversation = messages.length > 0;
  const resume = useCallback(() => setOpen(true), []);

  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <HotkeyListener />
      <AppHeader user={user} active="home" />

      <main id="home" className="lw-home">
        <div className="lw-home-greeting">
          <h1 className="lw-serif" style={{ fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1, margin: 0 }}>
            {greeting}, {user.firstName}.
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--lw-muted)" }}>{statusLine(today, closeIn, EXCEPTIONS.length + flags.length)}</p>
        </div>

        {/* --- Marginal ---------------------------------------------------- */}
        <section className="lw-ask" aria-label={`Ask ${SPOTTER_PERSONA_NAME}`}>
          <div className="lw-mono" style={{ letterSpacing: "0.16em", color: "var(--lw-blue-lt)" }}>{SPOTTER_PERSONA_NAME}</div>
          <h2 style={{ fontWeight: 600, fontSize: "clamp(19px, 2vw, 24px)", lineHeight: 1.25, letterSpacing: "-0.01em", margin: "8px 0 0", maxWidth: "36ch", textWrap: "pretty" }}>
            Ask about balances, growth, products or customer segments.
          </h2>

          {limitReached ? (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--lw-orange-lt)", margin: "16px 0 0" }}>
              You&rsquo;ve used all of your available queries for this period.
            </p>
          ) : null}

          <form
            className="lw-ask-row"
            onSubmit={(e) => {
              e.preventDefault();
              const question = draft.trim();
              if (question) { ask(question); return; }
              // Empty box with a thread already going: reopen it rather than
              // sit there doing nothing, which is what it used to do.
              if (hasConversation) resume();
            }}
          >
            <input
              className="lw-input lw-input-quiet"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={limitReached}
              placeholder={limitReached ? "Query limit reached" : "Which deposit cohorts drove the savings variance in Q3?"}
              style={{ flex: 1, minWidth: 240, borderColor: "var(--lw-paper)", padding: "14px 16px" }}
            />
            {limitReached ? (
              <button type="button" className="lw-btn lw-btn-primary" style={{ padding: "14px 24px" }} onClick={() => setUpsellOpen(true)}>
                Get more queries
              </button>
            ) : (
              <button type="submit" className="lw-btn lw-btn-primary" style={{ padding: "14px 24px" }}>
                {hasConversation && !draft.trim() ? "Resume" : "Ask"} <span aria-hidden>→</span>
              </button>
            )}
          </form>

          {/* The suggested prompts would be dead controls once the allowance
              is spent, so they give way to the meter instead. */}
          {limitReached ? (
            <div className="lw-mono" style={{ marginTop: 14, color: "var(--lw-muted-2)" }}>
              {consumedQueries.toLocaleString()} / {totalQueries.toLocaleString()} queries used
            </div>
          ) : (
            <div className="lw-ask-chips">
              {PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="lw-chip-ghost" onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* --- portfolio --------------------------------------------------- */}
        <section id="portfolio" className="lw-card" style={{ scrollMarginTop: 80 }}>
          <div className="lw-card-head">
            <h3 className="lw-card-title lw-serif">Portfolio</h3>
            <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
              <span className="lw-mono" style={{ color: "var(--lw-muted)" }}>vs. prior statement</span>
              <Link href="/analytics" className="lw-mono">Open analytics →</Link>
            </div>
          </div>
          <div className="lw-kpis">
            {PULSE.map((kpi) => (
              <div key={kpi.label} className="lw-kpi">
                <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>{kpi.label}</div>
                <div className="lw-serif" style={{ fontSize: "clamp(28px, 2.4vw, 34px)", lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>{kpi.value}</div>
                <div className="lw-mono" style={{ marginTop: 8, color: kpi.tint, textTransform: "none", letterSpacing: "0.04em", fontSize: 11 }}>{kpi.delta}</div>
              </div>
            ))}
          </div>
        </section>

        {/* --- attention + calendar + activity ---------------------------- */}
        <div className="lw-home-grid">
          <section id="exceptions" className="lw-card" style={{ scrollMarginTop: 80 }}>
            <div className="lw-card-head">
              <h3 className="lw-card-title lw-serif">
                Needs your attention
                <span className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.06em", background: "var(--lw-orange-dk)", color: "var(--lw-paper)", borderRadius: 999, padding: "4px 9px" }}>
                  {EXCEPTIONS.length + flags.length}
                </span>
              </h3>
              <a href="#exceptions" className="lw-mono">All exceptions</a>
            </div>
            <div>
              {flags.map((f) => (
                <a
                  key={f.id}
                  href="#exceptions"
                  className="lw-row lw-row-link"
                  style={{ gridTemplateColumns: "10px minmax(0, 1fr) auto" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--lw-blue)" }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, lineHeight: 1.35, textWrap: "pretty" }}>
                      Retention review — {f.cohort ?? `${f.region} region`}
                      {f.value != null ? ` · ${flagMoney(f.value)}` : ""}
                    </span>
                    <span className="lw-mono" style={{ display: "block", letterSpacing: "0.08em", color: "var(--lw-muted)", marginTop: 5 }}>
                      {f.region} · {f.owner.split(" · ")[0]}
                    </span>
                  </span>
                  <span
                    className="lw-mono"
                    style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--lw-blue)", border: "1px solid var(--lw-blue)", borderRadius: 999, padding: "5px 9px", whiteSpace: "nowrap" }}
                  >
                    flagged
                  </span>
                </a>
              ))}
              {EXCEPTIONS.map((x) => (
                <a
                  key={x.id}
                  href="#exceptions"
                  className="lw-row lw-row-link"
                  style={{ gridTemplateColumns: "10px minmax(0, 1fr) auto" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: x.tint }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, lineHeight: 1.35, textWrap: "pretty" }}>{x.text}</span>
                    <span className="lw-mono" style={{ display: "block", letterSpacing: "0.08em", color: "var(--lw-muted)", marginTop: 5 }}>
                      {x.id} · {x.who}
                    </span>
                  </span>
                  <span
                    className="lw-mono"
                    style={{ fontSize: 9, letterSpacing: "0.1em", color: x.ink, border: `1px solid ${x.tint}`, borderRadius: 999, padding: "5px 9px", whiteSpace: "nowrap" }}
                  >
                    {x.sev}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <div className="lw-stack">
            <section id="filings" className="lw-card" style={{ scrollMarginTop: 80 }}>
              <div className="lw-card-head">
                <h3 className="lw-card-title lw-serif">Filing calendar</h3>
                <span className="lw-mono" style={{ color: "var(--lw-muted)" }}>next 40 days</span>
              </div>
              <div>
                {FILINGS.map((f) => (
                  <div key={f.name} className="lw-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                    <span style={{ fontSize: 15, minWidth: 0 }}>{f.name}</span>
                    <span className="lw-mono" style={{ display: "flex", gap: 12, alignItems: "baseline", whiteSpace: "nowrap" }}>
                      <span style={{ color: f.ink }}>{f.state}</span>
                      <span style={{ color: "var(--lw-ink)" }}>{f.due}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section id="lineage" className="lw-card" style={{ scrollMarginTop: 80 }}>
              <div className="lw-card-head">
                <h3 className="lw-card-title lw-serif">Recent activity</h3>
                <span className="lw-mono" style={{ color: "var(--lw-muted)" }}>11 platforms</span>
              </div>
              <div>
                {ACTIVITY.map((a) => (
                  <div key={a.title} className="lw-row" style={{ gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>{a.time}</div>
                      <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, marginTop: 6 }}>{a.title}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--lw-ink-2)", marginTop: 4, textWrap: "pretty" }}>{a.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <AppFooter />

      <MarginalChat
        open={open}
        messages={messages}
        isBusy={isBusy}
        errorText={error?.message ?? null}
        onClose={closeChat}
        onAsk={ask}
        userRole={DEMO_ROLE}
        initialQuery={initialQuery}
        onGetMoreQueries={() => setUpsellOpen(true)}
        onNewChat={newChat}
      />

      <QueryLimitDialog open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}
