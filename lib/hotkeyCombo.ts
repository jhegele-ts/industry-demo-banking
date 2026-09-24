/**
 * A saved key combo for the /config "demo hotkeys" feature — press it and a
 * stored question is pasted into whatever field is focused.
 *
 * Combos must include Ctrl, Cmd or Alt (see `hasModifier`), so a saved combo
 * can never collide with someone simply typing.
 */
export interface KeyCombo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_KEYS = new Set(["control", "meta", "alt", "shift"]);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key.toLowerCase());
}

export function comboFromEvent(e: KeyboardEvent): KeyCombo {
  return {
    key: e.key.toLowerCase(),
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
  };
}

export function hasModifier(combo: KeyCombo): boolean {
  return combo.ctrlKey || combo.metaKey || combo.altKey;
}

export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key === b.key &&
    a.ctrlKey === b.ctrlKey &&
    a.metaKey === b.metaKey &&
    a.altKey === b.altKey &&
    a.shiftKey === b.shiftKey
  );
}

const KEY_DISPLAY: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
};

function displayKey(key: string): string {
  if (key in KEY_DISPLAY) return KEY_DISPLAY[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

export function formatCombo(combo: KeyCombo): string {
  const mac = isMac();
  const parts: string[] = [];
  if (combo.ctrlKey) parts.push(mac ? "⌃" : "Ctrl");
  if (combo.altKey) parts.push(mac ? "⌥" : "Alt");
  if (combo.shiftKey) parts.push(mac ? "⇧" : "Shift");
  if (combo.metaKey) parts.push(mac ? "⌘" : "Win");
  parts.push(displayKey(combo.key));
  return parts.join(mac ? "" : "+");
}

// A heads-up, not a block: browsers differ on whether these are actually
// overridable, and some platforms free them up entirely, so a combo that
// matches is still allowed to be saved.
const RESERVED: Array<{ test: (c: KeyCombo) => boolean; message: string }> = [
  {
    test: (c) => (c.ctrlKey || c.metaKey) && !c.altKey && /^[1-9]$/.test(c.key),
    message:
      "Browsers use Ctrl/Cmd+1–9 to switch tabs and may intercept this before the page sees it — adding Alt/Option avoids the clash.",
  },
  {
    test: (c) =>
      (c.ctrlKey || c.metaKey) && !c.altKey && ["t", "w", "n", "r", "l"].includes(c.key),
    message:
      "This is commonly reserved by the browser (new tab, close tab, reload) and may not reach the page.",
  },
];

export function reservedWarning(combo: KeyCombo): string | null {
  return RESERVED.find(({ test }) => test(combo))?.message ?? null;
}
