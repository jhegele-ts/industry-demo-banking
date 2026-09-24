"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  comboFromEvent,
  formatCombo,
  hasModifier,
  isModifierKey,
  reservedWarning,
  type KeyCombo,
} from "@/lib/hotkeyCombo";

/**
 * One saved hotkey: record a combo, type the phrase it pastes.
 *
 * While recording, a capture-phase listener swallows every keystroke so the
 * combo being recorded can't also trigger whatever it normally does.
 */
export default function HotkeyRow({
  initialCombo,
  initialPhrase,
  onSave,
  onRemove,
}: {
  initialCombo: KeyCombo | null;
  initialPhrase: string;
  onSave: (combo: KeyCombo, phrase: string) => void;
  onRemove: () => void;
}) {
  const [combo, setCombo] = useState<KeyCombo | null>(initialCombo);
  const [phrase, setPhrase] = useState(initialPhrase);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comboRef = useRef<KeyCombo | null>(initialCombo);

  useEffect(() => {
    if (!recording) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (isModifierKey(e.key)) return; // wait for the real key

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const next = comboFromEvent(e);
      if (!hasModifier(next)) {
        setError("Include Cmd, Ctrl or Alt so the combo can't collide with typing.");
        return;
      }
      comboRef.current = next;
      setCombo(next);
      setError(reservedWarning(next));
      setRecording(false);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording]);

  const save = useCallback(() => {
    const current = comboRef.current;
    if (!current) {
      setError("Record a combo first.");
      return;
    }
    if (!phrase.trim()) {
      setError("Add the text this hotkey should paste.");
      return;
    }
    onSave(current, phrase.trim());
  }, [phrase, onSave]);

  return (
    <div className="lw-hk">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="lw-hk-combo"
          onClick={() => { setError(null); setRecording(true); }}
          style={{ cursor: "pointer", color: recording ? "var(--lw-blue)" : "var(--lw-ink)" }}
        >
          {recording ? "Press keys…" : combo ? formatCombo(combo) : "Record combo"}
        </button>
        <input
          className="lw-input lw-input-quiet"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Which regions grew savings fastest?"
          style={{ flex: 1, minWidth: 200, fontSize: 13, padding: "10px 12px" }}
        />
      </div>

      {error ? (
        <p className="lw-mono lw-mono-sm" style={{ margin: 0, color: "var(--lw-err-ink)", textTransform: "none", letterSpacing: "0.02em", lineHeight: 1.6 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="lw-btn lw-btn-primary" style={{ fontSize: 11, padding: "9px 16px" }} onClick={save}>
          Save
        </button>
        <button type="button" className="lw-btn lw-btn-outline" style={{ fontSize: 11, padding: "9px 16px" }} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
