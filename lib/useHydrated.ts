import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Zustand's persisted stores read localStorage on the client only, so any UI
 * bound to them would render defaults on the server and real values on the
 * client — a hydration mismatch. Gate on this and render the stored values
 * once the client has taken over.
 *
 * useSyncExternalStore rather than an effect: it reports the difference
 * between the server and client snapshots directly, with no setState during
 * render or in an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
