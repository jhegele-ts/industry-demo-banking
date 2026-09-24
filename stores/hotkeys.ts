import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncAcrossTabs } from "@/stores/crossTab";
import type { KeyCombo } from "@/lib/hotkeyCombo";

export interface SavedHotkey {
  id: string;
  combo: KeyCombo;
  phrase: string;
}

interface HotkeysState {
  hotkeys: SavedHotkey[];
  addHotkey: (combo: KeyCombo, phrase: string) => void;
  updateHotkey: (id: string, combo: KeyCombo, phrase: string) => void;
  removeHotkey: (id: string) => void;
}

export const useHotkeys = create<HotkeysState>()(
  persist(
    (set) => ({
      hotkeys: [],
      addHotkey: (combo, phrase) =>
        set((s) => ({
          hotkeys: [...s.hotkeys, { id: crypto.randomUUID(), combo, phrase }],
        })),
      updateHotkey: (id, combo, phrase) =>
        set((s) => ({
          hotkeys: s.hotkeys.map((h) => (h.id === id ? { ...h, combo, phrase } : h)),
        })),
      removeHotkey: (id) =>
        set((s) => ({ hotkeys: s.hotkeys.filter((h) => h.id !== id) })),
    }),
    { name: "ledgerwise-hotkeys" },
  ),
);

// /config is usually open in its own tab; without this, changes made there
// don't reach the app until a reload.
syncAcrossTabs("ledgerwise-hotkeys", useHotkeys);
