"use client";

import { useEffect } from "react";
import { comboFromEvent, combosEqual, isModifierKey } from "@/lib/hotkeyCombo";
import { pasteIntoFocusedElement } from "@/lib/hotkeyPaste";
import { useHotkeys } from "@/stores/hotkeys";

/**
 * Listens app-wide, so there is no page allowlist to keep in step as pages are
 * added. A match copies its phrase to the clipboard (always available for a
 * manual Cmd/Ctrl+V — see hotkeyPaste for why that matters) and, best effort,
 * pastes it straight into whatever is focused.
 *
 * Every saved combo requires a modifier, enforced at save time, so matching
 * regardless of focus is safe: a hotkey press can't collide with normal typing
 * even inside a text field.
 */
export default function HotkeyListener() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isModifierKey(e.key)) return;

      const pressed = comboFromEvent(e);
      const match = useHotkeys
        .getState()
        .hotkeys.find((hotkey) => combosEqual(hotkey.combo, pressed));
      if (!match) return;

      e.preventDefault();
      navigator.clipboard?.writeText(match.phrase).catch(() => {});
      pasteIntoFocusedElement(match.phrase);
    }

    // Capture phase: with focus already in a text field, a bubble-phase
    // listener runs too late — the browser may act on the keystroke first
    // (Alt combos can start dead-key composition), which preventDefault can no
    // longer reliably cancel. Capture intercepts before the field sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
