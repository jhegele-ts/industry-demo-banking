"use client";

import { forwardRef } from "react";
import { LiveboardEmbed } from "@thoughtspot/visual-embed-sdk/react";
import type { ComponentRef } from "react";
// Side-effect import -- runs the guarded init() exactly once per page load.
import "@/lib/embedInit";
import { BRAND_CHAT_CONFIG } from "@/lib/embedBranding";

export type LiveboardRef = ComponentRef<typeof LiveboardEmbed>;

// ---------------------------------------------------------------------------
// Hoisted to module scope, NOT written inline in the JSX. The SDK
// deep-compares its view config and destroys/recreates the iframe whenever a
// prop's identity changes, and an object literal in JSX is a new identity on
// every render -- so an inline frameParams={{...}} reloads the embed on every
// parent re-render.
// ---------------------------------------------------------------------------
const FRAME_PARAMS = { width: "100%" };
const EMBED_STYLE = { width: "100%" };

/**
 * One liveboard, mounted once for the life of the page.
 *
 * Note what is NOT a prop here: the active tab. `initialTabId` is passed once
 * and never rebound -- later tab switches go through HostEvent.SetActiveTab
 * on the ref instead. Binding it to state would change the view config on
 * every click, tearing down and recreating the iframe and wiping whatever
 * filters the user had set on the liveboard. Same reasoning applies to any
 * runtime parameters added later.
 */
const LiveboardEmbedView = forwardRef<LiveboardRef, {
  liveboardId: string;
  initialTabId?: string;
}>(function LiveboardEmbedView({ liveboardId, initialTabId }, ref) {
  return (
    <div className="lw-embed-slot" style={{ minHeight: 720 }}>
      <LiveboardEmbed
        ref={ref}
        liveboardId={liveboardId}
        {...(initialTabId ? { activeTabId: initialTabId } : {})}
        fullHeight
        frameParams={FRAME_PARAMS}
        style={EMBED_STYLE}
        // Opts into the Spotter 3 chat interface when the assistant is
        // opened from a viz on this liveboard.
        updatedSpotterChatPrompt
        // Spotter opened from a viz renders the same response cards, so it
        // needs the same branding as the standalone embed.
        spotterChatConfig={BRAND_CHAT_CONFIG}
      />
    </div>
  );
});

export default LiveboardEmbedView;
