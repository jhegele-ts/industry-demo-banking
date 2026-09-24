import {
  CustomActionsPosition,
  CustomActionTarget,
  type LiveboardViewConfig,
} from "@thoughtspot/visual-embed-sdk";
import { LIVEBOARD_ID } from "@/lib/boards";

/**
 * Code-based custom actions, declared here and passed to the embed.
 *
 * "Code-based" matters: these need NO cluster configuration. They are not
 * created in Develop > Custom actions, they live in the view config (SDK
 * 1.43.0+, ThoughtSpot 10.14.0.cl+). Nothing has to be set up on
 * thoughtspotpmm for this to work, which is why it is safe to ship in a demo
 * that gets pointed at other clusters.
 *
 * Two things to know:
 *  - A UI-configured action sharing an id SUPPRESSES the code-based one, so
 *    keep this id distinctive.
 *  - The callback carries no viz data at all for liveboards -- documented,
 *    not a bug. Everything the flag dialog pre-fills therefore comes from the
 *    host: the region from the embed that fired, and the clicked point from
 *    EmbedEvent.VizPointClick, which we capture separately.
 *
 * Module scope, not inline: the SDK deep-compares its view config and an
 * array literal in JSX is a new identity on every render.
 */
export const FLAG_ACTION_ID = "lw-flag-retention";

/** The SDK exports the enums but not the CustomAction interface itself, so
 *  take it from the view config that consumes it. */
type CustomActionDef = NonNullable<LiveboardViewConfig["customActions"]>[number];

export const BALANCES_CUSTOM_ACTIONS: CustomActionDef[] = [
  {
    id: FLAG_ACTION_ID,
    name: "Flag for retention review",
    // In the viz's own menu, where the user just clicked a data point.
    position: CustomActionsPosition.CONTEXTMENU,
    target: CustomActionTarget.VIZ,
    // Every viz on this liveboard. Scoping to one viz would need its GUID,
    // and the board's tiles change more often than this app does.
    ...(LIVEBOARD_ID ? { metadataIds: { liveboardIds: [LIVEBOARD_ID] } } : {}),
  },
];

/** One selected attribute or measure on a clicked data point. */
interface VizPointItem {
  column?: { name?: string | null } | null;
  value?: unknown;
}

export interface ClickedPoint {
  cohort: string | null;
  measure: string | null;
  value: number | null;
}

/**
 * Pull the readable bits out of an EmbedEvent.VizPointClick payload.
 *
 * Walked defensively rather than indexed: the payload shape varies by chart
 * type and cluster version, and a missing point should degrade to a
 * region-level flag rather than throw inside an event handler.
 */
export function readClickedPoint(payload: unknown): ClickedPoint | null {
  const data = (payload as { data?: { clickedPoint?: unknown } })?.data;
  const point = data?.clickedPoint as
    | { selectedAttributes?: VizPointItem[]; selectedMeasures?: VizPointItem[] }
    | undefined;
  if (!point) return null;

  const attribute = point.selectedAttributes?.[0];
  const measure = point.selectedMeasures?.[0];

  const cohortName = attribute?.column?.name?.trim();
  // Dimension values in this model carry a sort prefix -- Customer Age Group
  // comes back as "a) 18-24" ... "f) 65+" so the chart orders correctly. That
  // prefix is a modelling detail and has no business meaning, so it is
  // stripped before the value is shown to a user or written into a note.
  // Deliberately narrow: a single letter, a close paren, whitespace.
  const cohortValue = (attribute?.value == null ? "" : String(attribute.value))
    .trim()
    .replace(/^[A-Za-z]\)\s*/, "");
  const measureName = measure?.column?.name?.trim();
  const rawValue = measure?.value;
  const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);

  const result: ClickedPoint = {
    cohort: cohortName && cohortValue ? `${cohortName}: ${cohortValue}` : (cohortValue || null),
    measure: measureName || null,
    value: Number.isFinite(numeric) ? numeric : null,
  };

  // Nothing readable came back -- treat as no point rather than an empty one.
  return result.cohort || result.measure ? result : null;
}
