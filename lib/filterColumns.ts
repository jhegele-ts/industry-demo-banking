import { cache } from "react";
import { SPOTTER_MODEL_ID } from "@/lib/boards";
import { getThoughtSpotAuthToken } from "@/lib/thoughtspot-auth";

const TS_HOST = process.env.NEXT_PUBLIC_TS_HOST ?? "";

/**
 * The filters actually saved on the Banking liveboard, by column name, read
 * from Banking_Liveboard.yaml. The artboard also drew an "Institution" chip;
 * no such filter exists on the liveboard, so it isn't here.
 *
 * `env` is an optional manual override — set it if resolution ever fails or
 * you want to pin a specific column.
 */
// `NEXT_PUBLIC_FILTER_COL_*=` with no value inlines as "" rather than
// undefined, so normalise it away here. Using `??` against the raw value is
// what made every chip grey out: "" is not nullish, so the empty override
// short-circuited the very lookup it exists to fall back to.
const override = (value: string | undefined): string | undefined =>
  value && value.trim() ? value.trim() : undefined;

const FILTER_COLUMNS: Array<{ label: string; column: string; env?: string }> = [
  { label: "Customer region", column: "Customer Region", env: override(process.env.NEXT_PUBLIC_FILTER_COL_REGION) },
  { label: "Customer state", column: "Customer State", env: override(process.env.NEXT_PUBLIC_FILTER_COL_STATE) },
  { label: "Statement date", column: "Statement Date", env: override(process.env.NEXT_PUBLIC_FILTER_COL_DATE) },
];

export interface ResolvedFilter {
  label: string;
  column: string;
  /** Empty when the column GUID could not be resolved. */
  columnId: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Match key for a column name. The metadata payload may use display names
 * ("Customer Region"), physical names ("CUSTOMER_REGION"), or camelCase, so
 * compare on letters and digits only.
 */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface FoundColumn {
  name: string;
  id: string;
  /** Object key this was found under, for diagnostics when nothing matches. */
  via: string;
}

/**
 * Walk the metadata detail for column-shaped objects and collect name → GUID.
 *
 * Deliberately structural rather than keyed to one exact path: the detail
 * payload's shape varies by cluster version and by whether the object is a
 * worksheet or a model, and a hard-coded `metadata_detail.columns[].header`
 * would return nothing (silently) the first time that changes. Anything
 * carrying both a name and a GUID-shaped id counts.
 */
function collectColumns(node: unknown, out: FoundColumn[], via = "$", depth = 0): void {
  if (depth > 10 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectColumns(item, out, via, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;
  const header = record.header as Record<string, unknown> | undefined;
  const id = record.id ?? header?.id;
  const name = record.name ?? header?.name;

  if (typeof id === "string" && GUID.test(id) && typeof name === "string" && name) {
    out.push({ name, id, via });
  }

  for (const [key, value] of Object.entries(record)) {
    collectColumns(value, out, key, depth + 1);
  }
}

/**
 * Resolves each liveboard filter to the column GUID that
 * HostEvent.OpenFilter needs.
 *
 * Runtime filters address columns by NAME, so /balances needs none of this —
 * only OpenFilter requires a GUID, and the liveboard TML doesn't carry one
 * (it references columns by name). Rather than making someone export the
 * model's TML and paste four GUIDs into .env.local, ask the metadata API.
 *
 * Cached per request: the page renders once and this runs once.
 */
export const getFilterColumns = cache(async (): Promise<ResolvedFilter[]> => {
  const fallback = FILTER_COLUMNS.map(({ label, column, env }) => ({
    label,
    column,
    columnId: env ?? "",
  }));

  // An explicit override for every column means there's nothing to look up.
  if (fallback.every((f) => f.columnId)) return fallback;
  if (!TS_HOST || !SPOTTER_MODEL_ID) return fallback;

  let token: string;
  try {
    token = await getThoughtSpotAuthToken();
  } catch {
    return fallback;
  }

  try {
    const response = await fetch(`${TS_HOST}/api/rest/2.0/metadata/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        metadata: [{ identifier: SPOTTER_MODEL_ID, type: "LOGICAL_TABLE" }],
        include_details: true,
        // Per the API docs: when searching by anything other than the
        // paginated parameters, send -1 / 0.
        record_size: -1,
        record_offset: 0,
      }),
    });

    if (!response.ok) {
      console.error("metadata/search failed", response.status, (await response.text()).slice(0, 300));
      return fallback;
    }

    const found: FoundColumn[] = [];
    collectColumns(await response.json(), found);

    // Rank by how trustworthy the source key is. The model's own `columns`
    // array carries display names ("Customer Region"); `header` repeats them
    // alongside physical ones; `logicalColumn` is the underlying physical
    // column ("REGION"). Preferring `columns` keeps display names winning.
    const rank = (via: string) => (via === "columns" ? 0 : via === "header" ? 1 : 2);
    const byName = new Map<string, string>();
    const ranked = [...found].sort((a, b) => rank(a.via) - rank(b.via));
    for (const col of ranked) {
      const key = norm(col.name);
      if (key && !byName.has(key)) byName.set(key, col.id);
    }

    const resolved = FILTER_COLUMNS.map(({ label, column, env }) => ({
      label,
      column,
      columnId: env ?? byName.get(norm(column)) ?? "",
    }));

    const missing = resolved.filter((f) => !f.columnId).map((f) => f.column);
    if (missing.length) {
      // Print what was actually found -- without this the failure is just
      // "didn't match", with no way to tell a shape mismatch from a naming
      // one. The model has dozens of columns, not thousands, so list them.
      const byVia = new Map<string, string[]>();
      for (const col of found) {
        byVia.set(col.via, [...(byVia.get(col.via) ?? []), col.name]);
      }
      console.warn(
        `[filterColumns] Could not resolve: ${missing.join(", ")}.\n` +
          `Found ${found.length} name+GUID pairs. By source key:\n` +
          [...byVia.entries()]
            .map(([via, names]) => `  ${via} (${names.length}): ${names.slice(0, 40).join(", ")}`)
            .join("\n") +
          `\nSet NEXT_PUBLIC_FILTER_COL_* to override.`,
      );
    }
    return resolved;
  } catch (error) {
    console.error("Failed to resolve filter column GUIDs", error);
    return fallback;
  }
});
