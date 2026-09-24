"use client";

import { useEffect } from "react";
import { SPOTTER_PERSONA_NAME } from "@/lib/embedBranding";
import { useMonetization } from "@/stores/monetization";

/**
 * The upsell shown once the query allowance is spent — the payoff of the
 * gating demo. "Buying" more just doubles the allowance in localStorage;
 * there's no billing anywhere near this.
 *
 * Sits above the chat panel (z 70 against its 60) so it reads as the same
 * moment whether it was opened from the Home panel or from inside the chat.
 */
export default function QueryLimitDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const totalQueries = useMonetization((s) => s.totalQueries);
  const setTotalQueries = useMonetization((s) => s.setTotalQueries);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Query limit reached"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 70, background: "rgba(20, 18, 15, 0.62)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px, 4vw, 44px)",
      }}
    >
      <div
        style={{
          width: "min(480px, 100%)", background: "var(--lw-ink)", color: "var(--lw-paper)",
          border: "1.5px solid var(--lw-ink)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 32px 70px -18px rgba(20, 18, 15, 0.6)",
          padding: "clamp(22px, 3vw, 32px)",
        }}
      >
        <div className="lw-mono" style={{ letterSpacing: "0.16em", color: "var(--lw-blue-lt)" }}>
          You&rsquo;re on a roll
        </div>

        <h2 className="lw-serif" style={{ fontSize: "clamp(26px, 3.2vw, 36px)", lineHeight: 1.05, margin: "12px 0 0", letterSpacing: "-0.02em" }}>
          You&rsquo;ve used all {totalQueries.toLocaleString()} of your queries.
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--lw-muted-2)", margin: "14px 0 0", textWrap: "pretty" }}>
          {SPOTTER_PERSONA_NAME} has been busy — and that&rsquo;s the good kind of problem. Teams
          that reach their limit this quickly typically see several times the insight once they
          move up a tier. Add another{" "}
          <span style={{ color: "var(--lw-blue-lt)", fontWeight: 600 }}>
            {totalQueries.toLocaleString()} queries
          </span>{" "}
          and carry on where you left off.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <button
            type="button"
            className="lw-btn lw-btn-primary"
            style={{ flex: 1, minWidth: 180, justifyContent: "center" }}
            onClick={() => { setTotalQueries(totalQueries * 2); onClose(); }}
          >
            Add {totalQueries.toLocaleString()} queries
          </button>
          <button
            type="button"
            className="lw-btn"
            style={{ background: "transparent", color: "var(--lw-paper)", borderColor: "var(--lw-muted)", justifyContent: "center" }}
            onClick={onClose}
          >
            Not now
          </button>
        </div>

        <p className="lw-mono" style={{ color: "var(--lw-muted)", marginTop: 16, textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          Demo only — this just raises the allowance in this browser. Reset it in /config.
        </p>
      </div>
    </div>
  );
}
