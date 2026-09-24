"use client";

import { useState } from "react";
import { SpotterEmbed } from "@thoughtspot/visual-embed-sdk/react";
// Side-effect import — runs the guarded init() once per page load.
import "@/lib/embedInit";
import { SPOTTER_MODEL_ID } from "@/lib/boards";
import { BRAND_CHAT_CONFIG } from "@/lib/embedBranding";

const FRAME_PARAMS = { width: "100%", height: "100%" };
const EMBED_STYLE = { width: "100%", height: "100%", minHeight: 420 };

/**
 * ThoughtSpot's own Spotter UI, the alternative to the MCP-backed Marginal.
 *
 * Switched from /config. The contrast is the point of having both: this is
 * ThoughtSpot's interface with our theme applied, while the MCP path is our
 * interface with ThoughtSpot only supplying the analysis.
 */
export default function SpotterChatEmbed({
  initialQuery,
  onQuery,
  onResponseComplete,
}: {
  initialQuery?: string;
  /** Fires once per question asked inside the embed. Must be referentially
   *  stable — the SDK rebuilds the iframe when a prop identity changes. */
  onQuery?: () => void;
  /** Fires when that question's answer has finished rendering. Same stability
   *  requirement. Together these bracket "Spotter is mid-answer", which is
   *  what stops the allowance running out from yanking the embed away
   *  before the last answer is readable. */
  onResponseComplete?: () => void;
}) {
  // Frozen at mount: searchOptions is a view-config prop, so letting its
  // identity change would tear down and rebuild the iframe mid-conversation.
  const [searchOptions] = useState(() =>
    initialQuery ? { searchQuery: initialQuery } : undefined,
  );

  if (!SPOTTER_MODEL_ID) {
    return (
      <p className="lw-mono lw-mono-sm" style={{ color: "var(--lw-muted)", textTransform: "none", lineHeight: 1.7 }}>
        Set NEXT_PUBLIC_SPOTTER_MODEL_ID in .env.local to use the Spotter experience.
      </p>
    );
  }

  return (
    <SpotterEmbed
      worksheetId={SPOTTER_MODEL_ID}
      hideSourceSelection
      {...(searchOptions ? { searchOptions } : {})}
      // Spotter owns its own composer, so this is the only way to know a
      // question was asked — without it, gating never counts in this mode.
      onSpotterQueryTriggered={onQuery}
      onSpotterResponseComplete={onResponseComplete}
      frameParams={FRAME_PARAMS}
      style={EMBED_STYLE}
      updatedSpotterExperience
      updatedSpotterChatPrompt
      spotterChatConfig={BRAND_CHAT_CONFIG}
    />
  );
}
