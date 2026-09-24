import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncAcrossTabs } from "@/stores/crossTab";

/**
 * Query gating, for demoing a metered AI plan. Purely a demo device — nothing
 * here reaches ThoughtSpot, it just stops Marginal answering once the count is
 * spent so the "you've hit your limit" moment can be shown on cue.
 */
interface MonetizationState {
  totalQueries: number;
  consumedQueries: number;
  enableGating: boolean;
  consumeQuery: () => void;
  setTotalQueries: (total: number) => void;
  setConsumedQueries: (consumed: number) => void;
  setEnableGating: (enabled: boolean) => void;
  resetUsage: () => void;
  resetToDefaults: () => void;
}

// Deliberately close to the limit out of the box: the interesting part of the
// demo is hitting it, and nobody wants to click 500 times to get there.
const DEFAULTS = { totalQueries: 500, consumedQueries: 497, enableGating: true };

export const useMonetization = create<MonetizationState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      consumeQuery: () => set((s) => ({ consumedQueries: s.consumedQueries + 1 })),
      setTotalQueries: (totalQueries) => set({ totalQueries }),
      setConsumedQueries: (consumedQueries) => set({ consumedQueries }),
      setEnableGating: (enableGating) => set({ enableGating }),
      resetUsage: () => set({ consumedQueries: 0 }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: "ledgerwise-monetization" },
  ),
);

/** True when gating is on and the allowance is spent. */
export function isLimitReached(s: {
  enableGating: boolean;
  consumedQueries: number;
  totalQueries: number;
}): boolean {
  return s.enableGating && s.consumedQueries >= s.totalQueries;
}

// /config is usually open in its own tab; without this, changes made there
// don't reach the app until a reload.
syncAcrossTabs("ledgerwise-monetization", useMonetization);
