import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncAcrossTabs } from "@/stores/crossTab";

/**
 * Retention flags raised from the liveboard on /balances.
 *
 * The demo's closing beat: a problem spotted inside the embed becomes a piece
 * of assigned work on /home. Purely a demo device — nothing leaves the
 * browser and no case-management system is contacted. Say so if asked; the
 * point being made is that the embed can hand context back to the host app,
 * not that we ship a case tracker.
 */
export interface RetentionFlag {
  id: string;
  region: string;
  /** Attribute of the clicked data point, e.g. "Customer Age Group: 35-44".
   *  Null when the action was raised without clicking a point first. */
  cohort: string | null;
  /** Measure and value of the clicked point, when there was one. */
  measure: string | null;
  value: number | null;
  owner: string;
  note: string;
  /** ISO. Rendered relative, so it has to be absolute in storage. */
  createdAt: string;
}

interface RetentionFlagsState {
  flags: RetentionFlag[];
  addFlag: (flag: Omit<RetentionFlag, "id" | "createdAt">) => void;
  removeFlag: (id: string) => void;
  clearFlags: () => void;
}

export const useRetentionFlags = create<RetentionFlagsState>()(
  persist(
    (set) => ({
      flags: [],
      addFlag: (flag) =>
        set((s) => ({
          // Newest first: /home shows these above the static exceptions, and
          // the one just raised is the one being talked about.
          flags: [
            { ...flag, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...s.flags,
          ],
        })),
      removeFlag: (id) => set((s) => ({ flags: s.flags.filter((f) => f.id !== id) })),
      clearFlags: () => set({ flags: [] }),
    }),
    { name: "ledgerwise-retention-flags" },
  ),
);

// /config is usually open in its own tab; without this, a reset there doesn't
// reach the app until a reload.
syncAcrossTabs("ledgerwise-retention-flags", useRetentionFlags);
