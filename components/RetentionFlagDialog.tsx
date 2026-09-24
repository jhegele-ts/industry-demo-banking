"use client";

import { useEffect, useRef, useState } from "react";
import { useRetentionFlags } from "@/stores/retentionFlags";
import type { ClickedPoint } from "@/lib/customActions";

/** Relationship managers to assign to. Invented, like the rest of the
 *  personnel in this demo — see "Known placeholder content" in CLAUDE.md. */
const OWNERS = [
  "Marisol Vega · Deposits",
  "Dev Raghunathan · Retail",
  "Priya Anand · Relationship",
  "Tom Okafor · Treasury",
];

/**
 * The note is an INSTRUCTION TO A PERSON, not an analysis — the same shape as
 * the note in the Forepost demo this beat is modelled on.
 *
 * It must never assert a finding. An earlier version described a
 * checking-vs-savings divergence, which was true of the insight tile on the
 * day it was written and false a week later when the tile regenerated around
 * IRA concentration instead. The tile's output is not stable (see the
 * insight-tile trap in CLAUDE.md), so anything hardcoded about *what the data
 * says* will eventually contradict the board it is sitting next to.
 *
 * What IS reliable is what the user clicked, so the note is built from that.
 */
function defaultNote(region: string, cohort: string | null): string {
  const subject = cohort ? `${cohort} in ${region}` : `the ${region} region`;
  return `Please review ${subject} and recommend a retention action before the next pricing cycle.`;
}

export interface FlagRequest {
  region: string;
  point: ClickedPoint | null;
}

function money(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * The closing beat: a data point inside the embed becomes assigned work.
 *
 * Everything pre-filled here comes from the HOST, not the action payload —
 * code-based custom actions on liveboards return no viz data at all. The
 * region comes from the embed that fired, and the cohort and value come from
 * the last EmbedEvent.VizPointClick. Opened without clicking a point first,
 * it degrades to a region-level flag rather than refusing.
 *
 * Nothing leaves the browser. See stores/retentionFlags.ts.
 */
export default function RetentionFlagDialog({
  request,
  onClose,
}: {
  request: FlagRequest | null;
  onClose: () => void;
}) {
  const addFlag = useRetentionFlags((s) => s.addFlag);
  const [owner, setOwner] = useState(OWNERS[0]);
  // Computed in the initialiser, which is safe because the parent keys this
  // per opening -- it remounts rather than resetting.
  const [note, setNote] = useState(() =>
    defaultNote(request?.region ?? "this region", request?.point?.cohort ?? null),
  );
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // No reset effect: the parent gives this a `key` per opening, so it
  // remounts and the state initialisers above run fresh. Resetting in an
  // effect instead would trip react-hooks/set-state-in-effect, and would
  // cascade a second render every time it opened.
  useEffect(() => {
    // Focus only -- not state, so it belongs here.
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;

  const { region, point } = request;

  const submit = () => {
    addFlag({
      region,
      cohort: point?.cohort ?? null,
      measure: point?.measure ?? null,
      value: point?.value ?? null,
      owner,
      note: note.trim(),
    });
    setDone(true);
  };

  return (
    <div className="lw-flag-scrim" role="presentation" onClick={onClose}>
      <div
        className="lw-flag"
        role="dialog"
        aria-modal="true"
        aria-label="Flag for retention review"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lw-flag-head">
          <div>
            <div className="lw-mono lw-flag-eyebrow">Retention review</div>
            <h2 className="lw-serif lw-flag-title">
              {done ? "Flag raised" : "Flag for retention review"}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="lw-flag-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {done ? (
          <div className="lw-flag-body">
            <p className="lw-flag-done">
              Assigned to <strong>{owner.split(" · ")[0]}</strong> and added to{" "}
              <strong>Needs your attention</strong> on Home.
            </p>
            <div className="lw-flag-actions">
              <button type="button" className="lw-btn lw-btn-outline lw-flag-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="lw-flag-body">
            {/* Read-only context, carried across from the board. */}
            <dl className="lw-flag-facts">
              <div>
                <dt className="lw-mono">Region</dt>
                <dd>{region}</dd>
              </div>
              <div>
                <dt className="lw-mono">Cohort</dt>
                <dd>{point?.cohort ?? "All customers in region"}</dd>
              </div>
              <div>
                <dt className="lw-mono">Measure</dt>
                <dd>{point?.measure ?? "Deposit mix"}</dd>
              </div>
              <div>
                <dt className="lw-mono">Value</dt>
                <dd>{point?.value != null ? money(point.value) : "—"}</dd>
              </div>
            </dl>

            <label className="lw-flag-field">
              <span className="lw-mono">Assign to</span>
              <select className="lw-flag-select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {OWNERS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="lw-flag-field">
              <span className="lw-mono">Note</span>
              <textarea
                className="lw-flag-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <div className="lw-flag-actions">
              <button type="button" className="lw-btn lw-btn-outline lw-flag-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="lw-flag-submit" onClick={submit} disabled={!note.trim()}>
                Raise flag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
