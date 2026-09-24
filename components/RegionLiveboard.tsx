"use client";

import { useCallback, useRef, useState } from "react";
import { LiveboardEmbed, RuntimeFilterOp } from "@thoughtspot/visual-embed-sdk/react";
// Side-effect import -- runs the guarded init() once per page load.
import "@/lib/embedInit";
import { BALANCES_TAB_ID, LIVEBOARD_ID, REGION_COLUMN } from "@/lib/boards";
import { BRAND_CHAT_CONFIG } from "@/lib/embedBranding";
import {
  BALANCES_CUSTOM_ACTIONS,
  FLAG_ACTION_ID,
  readClickedPoint,
  type ClickedPoint,
} from "@/lib/customActions";

const FRAME_PARAMS = { width: "100%", height: "620px" };
const EMBED_STYLE = { width: "100%" };

/**
 * The liveboard for one region, scoped by a runtime filter.
 *
 * This only mounts while its accordion section is open, so the filter can be
 * set once at mount and never changed -- no HostEvent.UpdateRuntimeFilters
 * needed. The parent gives each instance a `key` of the region, so switching
 * regions is a clean remount rather than a view-config change (which the SDK
 * would handle by tearing the iframe down and rebuilding it anyway).
 *
 * `runtimeFilters` is frozen in state rather than rebuilt inline: the array
 * is a new identity on every render, and the SDK deep-compares its view
 * config, so an inline literal would rebuild the iframe whenever the parent
 * re-rendered for any reason.
 */
export default function RegionLiveboard({
  region,
  onFlag,
}: {
  region: string;
  /** Raised when the "Flag for retention review" custom action fires. Must be
   *  a stable identity -- see the handler note below. */
  onFlag?: (region: string, point: ClickedPoint | null) => void;
}) {
  const [filters] = useState(() => [
    { columnName: REGION_COLUMN, operator: RuntimeFilterOp.EQ, values: [region] },
  ]);

  // The custom action's callback carries no viz data -- that is documented
  // for code-based actions on liveboards, not a bug. So the clicked point is
  // captured separately as it happens and read back when the action fires.
  // A ref, not state: nothing renders from it, and setting state here would
  // rebuild the embed.
  const lastPoint = useRef<ClickedPoint | null>(null);

  // Both handlers must have a STABLE identity. The React wrapper puts its
  // listeners in a deep-compare dependency array and functions compare by
  // reference there, so an inline arrow would tear down and rebuild the
  // iframe on every parent render.
  //
  // The deps below are safe rather than merely convenient: the parent keys
  // each embed by region, so `region` never changes for a given instance, and
  // it passes `onFlag` as a useCallback. Writing the point to a ref inside a
  // handler is fine -- it is the writes DURING RENDER that react-hooks/refs
  // forbids.
  const handleVizPointClick = useCallback((payload: unknown) => {
    lastPoint.current = readClickedPoint(payload);
  }, []);

  const handleCustomAction = useCallback(
    (payload: unknown) => {
      const id = (payload as { data?: { id?: string } })?.data?.id;
      if (id !== FLAG_ACTION_ID) return;
      onFlag?.(region, lastPoint.current);
    },
    [region, onFlag],
  );

  return (
    <LiveboardEmbed
      liveboardId={LIVEBOARD_ID}
      {...(BALANCES_TAB_ID ? { activeTabId: BALANCES_TAB_ID } : {})}
      runtimeFilters={filters}
      frameParams={FRAME_PARAMS}
      style={EMBED_STYLE}
      // Spotter can be launched from any viz on this board, including the AI
      // insight tile. Without these two it opens with the older chat prompt
      // and ThoughtSpot's own branding on the response cards -- the "T" icon
      // that is hidden everywhere else in this app. /analytics passes the
      // same pair; keep them in step.
      updatedSpotterChatPrompt
      spotterChatConfig={BRAND_CHAT_CONFIG}
      // Code-based: declared in the view config, NOT on the cluster. Nothing
      // has to be set up in Develop > Custom actions for this to appear.
      customActions={BALANCES_CUSTOM_ACTIONS}
      onVizPointClick={handleVizPointClick}
      onCustomAction={handleCustomAction}
    />
  );
}
