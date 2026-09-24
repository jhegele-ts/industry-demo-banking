"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import MarginalAnswer from "@/components/MarginalAnswer";
import SpotterChatEmbed from "@/components/SpotterChatEmbed";
import { SPOTTER_PERSONA_NAME } from "@/lib/embedBranding";
import { useHydrated } from "@/lib/useHydrated";
import { useAppConfig } from "@/stores/appConfig";
import { isLimitReached, useMonetization } from "@/stores/monetization";

/**
 * Static chips, shown after every answer, so each has to be a pivot that
 * works on almost any reply AND that the model can actually serve.
 *
 * The originals asked for lineage and for "which institutions drove it".
 * Neither exists: this is retail deposit and customer analytics -- balances,
 * growth, credit rating, age group, income group, product, region -- with no
 * lineage and no institution dimension. Two of three failed live. Keep any
 * replacement inside that column list; see "Known placeholder content" in
 * CLAUDE.md.
 */
const FOLLOW_UPS = [
  "Break that down by age group",
  "Compare it across regions",
  "How has it trended over 12 months?",
];

/** Concatenate the text parts of a UIMessage. */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}

/** Marginal is told to embed visualizations as raw <iframe>. Those answers
 *  need the full panel width — 64ch is about 500px, which squeezes a chart
 *  into a column narrower than its own axis labels. */
function hasEmbed(text: string): boolean {
  return /<iframe\b/i.test(text);
}

/** The most recent tool progress line, used for the thinking indicator. */
function latestStatus(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of [...messages[i].parts].reverse()) {
      const output = (part as { output?: unknown }).output;
      if (output && typeof output === "object" && "status" in output) {
        const status = (output as { status?: unknown }).status;
        if (typeof status === "string") return status;
      }
    }
  }
  return null;
}

export default function MarginalChat({
  open,
  messages,
  isBusy,
  errorText,
  onClose,
  onAsk,
  userRole,
  initialQuery,
  onGetMoreQueries,
  onNewChat,
}: {
  open: boolean;
  messages: UIMessage[];
  isBusy: boolean;
  errorText: string | null;
  onClose: () => void;
  onAsk: (question: string) => void;
  userRole: string;
  /** The last question typed in the page composer — handed to Spotter as its
   *  opening query, since in that mode the composer below is hidden. */
  initialQuery?: string;
  /** Opens the upsell dialog, which HomeClient owns so both entry points
   *  show the same one. */
  onGetMoreQueries?: () => void;
  /** Clears the MCP thread. Spotter's transcript lives inside its iframe, so
   *  that side is remounted here rather than cleared by the parent. */
  onNewChat?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [maximized, setMaximized] = useState(false);

  // Demo controls from /config. Gated on hydration so the server render and
  // the first client render agree; until then this behaves as the defaults.
  const hydrated = useHydrated();
  const agentExperience = useAppConfig((s) => s.agentExperience);
  const enableGating = useMonetization((s) => s.enableGating);
  const consumedQueries = useMonetization((s) => s.consumedQueries);
  const totalQueries = useMonetization((s) => s.totalQueries);
  const spotterMode = hydrated && agentExperience === "spotter";
  const showMeter = hydrated && enableGating;

  // Spotter owns its composer, so "mid-answer" has to be inferred from its
  // own events rather than from our request state. `spotterUsed` records that
  // a conversation exists and is therefore worth preserving — see the render
  // below for why that matters when the allowance runs out.
  const [spotterBusy, setSpotterBusy] = useState(false);
  const [spotterUsed, setSpotterUsed] = useState(Boolean(initialQuery));
  // Bumped to remount the embed on "New chat". Preferred over
  // HostEvent.StartNewSpotterConversation, which needs ThoughtSpot 26.2.0.cl
  // and does nothing at all on older clusters.
  const [spotterEpoch, setSpotterEpoch] = useState(0);
  const spotterTimer = useRef<number | null>(null);
  const answering = isBusy || spotterBusy;

  // The allowance is spent the moment a question is sent, so the counter
  // ticks straight away — but the BLOCKED state waits until nothing is in
  // flight. Otherwise spending your last query tears down the composer (and,
  // in Spotter mode, the embed itself) while that answer is still arriving,
  // which reads as the question having been cancelled.
  const limitReached =
    hydrated &&
    !answering &&
    isLimitReached({ enableGating, consumedQueries, totalQueries });
  const meterPct =
    totalQueries > 0 ? Math.min(100, (consumedQueries / totalQueries) * 100) : 100;
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleMaximized = useCallback(() => {
    // A corner drag sets inline width/height on the panel, which outranks the
    // [data-max] rule. Clear them so the stylesheet governs again.
    const panel = panelRef.current;
    if (panel) {
      panel.style.width = "";
      panel.style.height = "";
    }
    setMaximized((current) => !current);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, isBusy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Stable by construction: reads the store at call time rather than closing
  // over it, so the embed's prop identity never changes.
  const onSpotterQuery = useCallback(() => {
    setSpotterUsed(true);
    setSpotterBusy(true);
    // Fallback: if the completion event never arrives, busy would stick on
    // and the gate would never close again. Same defensive shape the SDK
    // notes advise for any "wait for a render event" code.
    if (spotterTimer.current) window.clearTimeout(spotterTimer.current);
    spotterTimer.current = window.setTimeout(() => setSpotterBusy(false), 120_000);

    const money = useMonetization.getState();
    if (money.enableGating) money.consumeQuery();
  }, []);

  const newChat = useCallback(() => {
    onNewChat?.();
    if (spotterTimer.current) window.clearTimeout(spotterTimer.current);
    setSpotterBusy(false);
    setSpotterUsed(false);
    setSpotterEpoch((n) => n + 1);
  }, [onNewChat]);

  const onSpotterDone = useCallback(() => {
    if (spotterTimer.current) window.clearTimeout(spotterTimer.current);
    setSpotterBusy(false);
  }, []);

  useEffect(() => () => {
    if (spotterTimer.current) window.clearTimeout(spotterTimer.current);
  }, []);

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      setDraft("");
      onAsk(trimmed);
    },
    [onAsk],
  );

  if (!open) return null;

  const status = latestStatus(messages);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${SPOTTER_PERSONA_NAME} — ask about your data`}
      style={{
        // 0.68, not 0.55: over a cream page the lighter scrim left the
        // background bright enough to compete with the panel's own cream.
        position: "fixed", inset: 0, zIndex: 60, background: "rgba(20, 18, 15, 0.68)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vw, 44px)",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} className="lw-chat-panel" data-max={maximized}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: "var(--lw-ink)", color: "var(--lw-paper)", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 10, height: 10, background: "var(--lw-orange-lt)", borderRadius: "50%", flex: "none" }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{SPOTTER_PERSONA_NAME}</span>
              <span className="lw-mono lw-mono-sm" style={{ display: "block", color: "var(--lw-muted-2)", marginTop: 3 }}>{userRole}</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            <button
              type="button"
              onClick={newChat}
              className="lw-mono"
              style={{
                border: "1.5px solid var(--lw-muted)", background: "transparent",
                color: "var(--lw-paper)", padding: "8px 12px", borderRadius: 8, cursor: "pointer",
              }}
            >
              New chat
            </button>
            <button
              type="button"
              onClick={toggleMaximized}
              aria-label={maximized ? "Restore size" : "Maximize"}
              title={maximized ? "Restore size" : "Maximize"}
              className="lw-mono"
              style={{ fontSize: 13, lineHeight: 1, background: "transparent", color: "var(--lw-paper)", border: "1.5px solid var(--lw-muted)", borderRadius: 6, width: 32, height: 32, cursor: "pointer", letterSpacing: 0 }}
            >
              {maximized ? "⤡" : "⤢"}
            </button>
            <button
              type="button" onClick={onClose} aria-label="Close" className="lw-mono"
              style={{ fontSize: 14, lineHeight: 1, background: "transparent", color: "var(--lw-paper)", border: "1.5px solid var(--lw-muted)", borderRadius: 6, width: 32, height: 32, cursor: "pointer", letterSpacing: 0 }}
            >
              ×
            </button>
          </div>
        </div>

        {showMeter ? (
          <div style={{ padding: "12px clamp(14px, 2.4vw, 24px)", background: "var(--lw-ink)", borderBottom: "1px solid var(--lw-ink-2)" }}>
            <div
              className="lw-mono"
              style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7, color: limitReached ? "var(--lw-orange-lt)" : "var(--lw-muted-2)" }}
            >
              <span>Queries used</span>
              <span>{consumedQueries} / {totalQueries}</span>
            </div>
            <div className="lw-meter" data-spent={limitReached}>
              <span style={{ width: `${meterPct}%` }} />
            </div>
          </div>
        ) : null}

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "clamp(18px, 2.6vw, 30px)", display: "flex", flexDirection: "column", gap: 20 }}>
          {spotterMode ? (
            // Only replace the embed when there is no conversation to lose.
            // Once Spotter has answered something, unmounting it throws away
            // the very answer the last query paid for — so the limit is
            // stated above the embed and the transcript stays readable.
            limitReached && !spotterUsed ? (
              <p style={{ margin: "auto 0", textAlign: "center", fontSize: 14, color: "var(--lw-err-ink)", lineHeight: 1.7 }}>
                You&rsquo;ve used all of your available queries for this period.
              </p>
            ) : (
              <>
                {limitReached ? (
                  <div
                    role="status"
                    style={{
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                      border: "1.5px solid var(--lw-orange)", background: "var(--lw-err-bg)",
                      color: "var(--lw-err-ink)", borderRadius: 8, padding: "12px 14px", fontSize: 14,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 200, lineHeight: 1.5 }}>
                      You&rsquo;ve used all of your available queries for this period.
                    </span>
                    {onGetMoreQueries ? (
                      <button type="button" className="lw-btn lw-btn-primary" style={{ fontSize: 11, padding: "9px 16px" }} onClick={onGetMoreQueries}>
                        Get more queries
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <SpotterChatEmbed
                  key={spotterEpoch}
                  initialQuery={initialQuery}
                  onQuery={onSpotterQuery}
                  onResponseComplete={onSpotterDone}
                />
              </>
            )
          ) : null}

          {spotterMode ? null : messages.map((message) => {
            const text = messageText(message);
            if (!text) return null;
            const self = message.role === "user";
            return (
              <div key={message.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: self ? "flex-end" : "flex-start" }}>
                <span
                  className="lw-mono lw-mono-sm"
                  style={{ color: "var(--lw-paper)", background: self ? "var(--lw-blue)" : "var(--lw-ink)", padding: "6px 8px", flex: "none" }}
                >
                  {self ? "You" : SPOTTER_PERSONA_NAME}
                </span>
                <span
                  style={{
                    maxWidth: hasEmbed(text) ? "100%" : "64ch",
                    flex: hasEmbed(text) ? 1 : undefined,
                    minWidth: 0,
                    fontSize: 15, lineHeight: 1.6, color: "var(--lw-ink)",
                    background: self ? "var(--lw-blue-pale)" : "var(--lw-paper-3)",
                    border: "1.5px solid var(--lw-ink)", padding: "14px 16px", textWrap: "pretty", borderRadius: 8,
                  }}
                >
                  {self ? text : <MarginalAnswer text={text} />}
                </span>
              </div>
            );
          })}

          {errorText ? (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span className="lw-mono lw-mono-sm" style={{ color: "var(--lw-paper)", background: "var(--lw-orange)", padding: "6px 8px", flex: "none" }}>Error</span>
              <span style={{ maxWidth: "64ch", fontSize: 15, lineHeight: 1.6, background: "var(--lw-err-bg)", border: "1.5px solid var(--lw-ink)", padding: "14px 16px", borderRadius: 8, whiteSpace: "pre-wrap" }}>
                {errorText}
              </span>
            </div>
          ) : null}

          {isBusy ? (
            <div className="lw-mono lw-mono-sm" style={{ color: "var(--lw-muted)", textTransform: "none", letterSpacing: "0.06em" }}>
              {status ?? `${SPOTTER_PERSONA_NAME} is reading the semantic layer`}
            </div>
          ) : null}
        </div>

        {spotterMode ? null : (
        <div style={{ borderTop: "1.5px solid var(--lw-ink)", padding: "14px clamp(14px, 2.4vw, 24px) 16px", background: "var(--lw-paper-2)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FOLLOW_UPS.map((label) => (
              <button key={label} type="button" className="lw-chip" disabled={isBusy || limitReached} onClick={() => send(label)}>
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <input
              className="lw-input" value={draft} onChange={(e) => setDraft(e.target.value)}
              disabled={limitReached}
              placeholder={limitReached ? "Query limit reached" : "Ask a follow-up, or name a region, product or cohort…"}
              style={{ flex: 1, minWidth: 220, fontSize: 13, padding: 14 }}
            />
            <button type="submit" className="lw-btn lw-btn-primary" disabled={isBusy || limitReached} style={{ fontSize: 12, padding: "14px 26px" }}>
              Send
            </button>
          </form>
          {limitReached ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <span className="lw-mono" style={{ letterSpacing: "0.08em", color: "var(--lw-err-ink)", textTransform: "none" }}>
                You&rsquo;ve used all of your available queries for this period.
              </span>
              {onGetMoreQueries ? (
                <button type="button" className="lw-btn lw-btn-primary" style={{ fontSize: 11, padding: "9px 16px" }} onClick={onGetMoreQueries}>
                  Get more queries
                </button>
              ) : null}
            </div>
          ) : (
            <div className="lw-mono" style={{ letterSpacing: "0.08em", color: "var(--lw-muted)", marginTop: 10, textTransform: "none" }}>
              Generated from live account data. Check the figures before they go in a report.
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
