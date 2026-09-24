"use client";

import Link from "next/link";
import { useState } from "react";
import HotkeyRow from "@/components/HotkeyRow";
import { SPOTTER_PERSONA_NAME } from "@/lib/embedBranding";
import { useHydrated } from "@/lib/useHydrated";
import { useAppConfig } from "@/stores/appConfig";
import { useHotkeys } from "@/stores/hotkeys";
import { useMonetization } from "@/stores/monetization";
import { useRetentionFlags } from "@/stores/retentionFlags";
import type { KeyCombo } from "@/lib/hotkeyCombo";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>
      {children}
    </div>
  );
}

export default function ConfigClient() {
  // Persisted stores read localStorage client-side only, so render defaults
  // until the client has taken over or the markup won't match.
  const hydrated = useHydrated();

  const agentExperience = useAppConfig((s) => s.agentExperience);
  const flags = useRetentionFlags((s) => s.flags);
  const clearFlags = useRetentionFlags((s) => s.clearFlags);
  const setAgentExperience = useAppConfig((s) => s.setAgentExperience);

  const enableGating = useMonetization((s) => s.enableGating);
  const setEnableGating = useMonetization((s) => s.setEnableGating);
  const consumedQueries = useMonetization((s) => s.consumedQueries);
  const totalQueries = useMonetization((s) => s.totalQueries);
  const setConsumedQueries = useMonetization((s) => s.setConsumedQueries);
  const setTotalQueries = useMonetization((s) => s.setTotalQueries);
  const resetMonetization = useMonetization((s) => s.resetToDefaults);
  const resetAppConfig = useAppConfig((s) => s.resetToDefaults);

  const hotkeys = useHotkeys((s) => s.hotkeys);
  const addHotkey = useHotkeys((s) => s.addHotkey);
  const updateHotkey = useHotkeys((s) => s.updateHotkey);
  const removeHotkey = useHotkeys((s) => s.removeHotkey);
  const [drafting, setDrafting] = useState(false);

  return (
    <div className="lw-cfg">
      <div>
        <Label>Internal</Label>
        <h1 className="lw-serif" style={{ fontSize: "clamp(32px, 4vw, 46px)", lineHeight: 1, margin: "10px 0 0" }}>
          Demo config
        </h1>
        <p className="lw-cfg-help" style={{ marginTop: 12 }}>
          Controls how {SPOTTER_PERSONA_NAME} behaves during a demo. Everything here is stored in
          this browser only — nothing reaches ThoughtSpot, and nobody else sees it. This page
          isn&rsquo;t linked from anywhere else in the app.
        </p>
        <p className="lw-mono" style={{ color: "var(--lw-muted)", marginTop: 10 }}>
          <Link href="/home">← Back to the app</Link>
        </p>
      </div>

      {/* --- agent experience ------------------------------------------- */}
      <section className="lw-cfg-block">
        <Label>Agent experience</Label>
        <div className="lw-cfg-row">
          <p className="lw-cfg-help">
            Which backend answers questions on Home — Claude over ThoughtSpot&rsquo;s Spotter MCP
            server, white-labelled as {SPOTTER_PERSONA_NAME} (the default), or ThoughtSpot&rsquo;s
            own Spotter interface embedded directly.
          </p>
          <div className="lw-seg">
            <button type="button" aria-pressed={hydrated && agentExperience === "mcp"} onClick={() => setAgentExperience("mcp")}>
              MCP
            </button>
            <button type="button" aria-pressed={hydrated && agentExperience === "spotter"} onClick={() => setAgentExperience("spotter")}>
              Spotter UI
            </button>
          </div>
        </div>
      </section>

      {/* --- retention flags ---------------------------------------------- */}
      <section className="lw-cfg-block">
        <Label>Retention flags</Label>
        <div className="lw-cfg-row">
          <p className="lw-cfg-help">
            Flags raised from the liveboard on Balances, via the &ldquo;Flag for retention
            review&rdquo; action in a visualization&rsquo;s menu. They appear under{" "}
            <em>Needs your attention</em> on Home. Nothing leaves this browser — clear them
            between demos.
          </p>
          <button
            type="button"
            className="lw-btn lw-btn-outline"
            style={{ fontSize: 11, padding: "11px 18px", whiteSpace: "nowrap" }}
            disabled={!hydrated || flags.length === 0}
            onClick={clearFlags}
          >
            {hydrated && flags.length > 0 ? `Clear ${flags.length}` : "No flags"}
          </button>
        </div>
      </section>

      {/* --- gating ------------------------------------------------------ */}
      <section className="lw-cfg-block">
        <Label>Query gating</Label>
        <div className="lw-cfg-row">
          <p className="lw-cfg-help">
            With this on, {SPOTTER_PERSONA_NAME} shows a usage meter and refuses new questions once
            the allowance is spent — the metered-AI-plan moment. Applies to both experiences above.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={hydrated && enableGating}
            aria-label="Enable query gating"
            className="lw-switch"
            onClick={() => setEnableGating(!enableGating)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 6 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>Queries used</Label>
            <input
              type="number" min={0} className="lw-input lw-input-quiet"
              value={hydrated ? consumedQueries : ""}
              onChange={(e) => setConsumedQueries(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>Total queries</Label>
            <input
              type="number" min={1} className="lw-input lw-input-quiet"
              value={hydrated ? totalQueries : ""}
              onChange={(e) => setTotalQueries(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        <p className="lw-mono" style={{ color: "var(--lw-muted)", marginTop: 4, textTransform: "none", letterSpacing: "0.04em" }}>
          {hydrated ? `${consumedQueries} / ${totalQueries} queries used` : "—"}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <button
            type="button" className="lw-btn lw-btn-outline" style={{ fontSize: 11, padding: "10px 16px" }}
            onClick={() => { resetMonetization(); resetAppConfig(); }}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      {/* --- hotkeys ------------------------------------------------------ */}
      <section className="lw-cfg-block">
        <Label>Demo hotkeys</Label>
        <p className="lw-cfg-help">
          Save a key combo that copies a stored question to the clipboard and pastes it into
          whatever is focused — any input in the app. Handy for hitting the same demo beats the
          same way every time. Combos always need Cmd, Ctrl or Alt so they never collide with
          normal typing, and they only paste the text: you still press send.
        </p>
        <p className="lw-cfg-help" style={{ color: "var(--lw-muted)" }}>
          ThoughtSpot&rsquo;s embeds are a cross-origin iframe no page script can type into, so
          inside Spotter click its field and press Cmd/Ctrl+V — the text is already on the clipboard.
        </p>

        {!hydrated ? null : hotkeys.length === 0 && !drafting ? (
          <p className="lw-cfg-help" style={{ fontStyle: "italic", color: "var(--lw-muted)" }}>No hotkeys saved yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {hotkeys.map((hotkey) => (
              <HotkeyRow
                key={hotkey.id}
                initialCombo={hotkey.combo}
                initialPhrase={hotkey.phrase}
                onSave={(combo: KeyCombo, phrase: string) => updateHotkey(hotkey.id, combo, phrase)}
                onRemove={() => removeHotkey(hotkey.id)}
              />
            ))}
            {drafting ? (
              <HotkeyRow
                initialCombo={null}
                initialPhrase=""
                onSave={(combo: KeyCombo, phrase: string) => { addHotkey(combo, phrase); setDrafting(false); }}
                onRemove={() => setDrafting(false)}
              />
            ) : null}
          </div>
        )}

        {hydrated && !drafting ? (
          <div>
            <button type="button" className="lw-btn lw-btn-outline" style={{ fontSize: 11, padding: "10px 16px" }} onClick={() => setDrafting(true)}>
              + Add hotkey
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
