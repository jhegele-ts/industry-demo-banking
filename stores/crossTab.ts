/**
 * Keeps a persisted store in step across browser tabs.
 *
 * Zustand's `persist` writes to localStorage, but a store is a module
 * singleton per page load: it reads storage once at creation and never looks
 * again. Change a setting on /config in one tab and the app in another tab
 * keeps its stale copy until reloaded — which is exactly how /config gets
 * used, since it is unlinked and opened on its own.
 *
 * The `storage` event fires only in *other* tabs, so this never re-enters on
 * the tab that made the change.
 */
interface Rehydratable {
  persist: { rehydrate: () => void | Promise<void> };
}

export function syncAcrossTabs(storageKey: string, store: Rehydratable): void {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    // A null key means the whole store was cleared; rehydrate for that too.
    if (event.key !== null && event.key !== storageKey) return;
    void store.persist.rehydrate();
  });
}
