import { createBearerAuthenticationConfig, DataApi } from "@thoughtspot/rest-api-sdk";
import { getThoughtSpotAuthToken } from "@/lib/thoughtspot-auth";
import { SPOTTER_MODEL_ID } from "@/lib/boards";

const TS_HOST = process.env.NEXT_PUBLIC_TS_HOST ?? "";

/**
 * Region rows for /balances, fetched with the searchdata REST API.
 *
 * Column names come from the Banking model (confirmed against
 * Banking_Liveboard.yaml). `sum [...]` is explicit so the aggregation is ours
 * rather than whatever the model defaults to.
 */
const QUERY_STRING =
  "[Customer Region] sum [Current Savings Balance] sum [Current Checking Balance] sum [Current IRA Balance] [Number of Customers]";

export interface RegionBalance {
  region: string;
  savings: number;
  checking: number;
  /** The largest deposit type in this book by some distance, and the one the
   *  demo's argument rests on — so the page shows it rather than hiding it
   *  until a region is expanded. */
  ira: number;
  customers: number;
}

export interface RegionBalancesResult {
  rows: RegionBalance[];
  error: string | null;
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ThoughtSpot renames an aggregated measure in the result set -- `sum
 * [Current Savings Balance]` comes back as "Total Current Savings Balance".
 * Which prefix it uses depends on the aggregation and the model's defaults,
 * so try the likely names rather than hard-coding one and silently reading 0.
 */
function measure(row: Record<string, unknown>, base: string): number {
  const candidates = [`Total ${base}`, base, `Sum ${base}`, `Average ${base}`];
  for (const key of candidates) {
    if (row[key] != null) return toNumber(row[key]);
  }
  return 0;
}

export async function getRegionBalances(): Promise<RegionBalancesResult> {
  if (!TS_HOST || !SPOTTER_MODEL_ID) {
    return {
      rows: [],
      error: "Set NEXT_PUBLIC_TS_HOST and NEXT_PUBLIC_SPOTTER_MODEL_ID in .env.local.",
    };
  }

  let authToken: string;
  try {
    authToken = await getThoughtSpotAuthToken();
  } catch {
    return { rows: [], error: "Not signed in." };
  }

  try {
    const dataApi = new DataApi(
      createBearerAuthenticationConfig(TS_HOST, () => Promise.resolve(authToken)),
    );
    const response = await dataApi.searchData({
      query_string: QUERY_STRING,
      logical_table_identifier: SPOTTER_MODEL_ID,
      // Defaults to 10 otherwise. -1 is ThoughtSpot's documented sentinel for
      // "no pagination, return every row".
      record_size: -1,
    });

    // searchData wraps one result set per query; we only send one.
    const content = response.contents?.[0];
    if (!content) return { rows: [], error: null };

    const rows = content.data_rows
      .map((row: unknown[]) =>
        Object.fromEntries(content.column_names.map((name, i) => [name, row[i]])),
      )
      .map((row) => ({
        region: String(row["Customer Region"] ?? "").trim(),
        savings: measure(row, "Current Savings Balance"),
        checking: measure(row, "Current Checking Balance"),
        ira: measure(row, "Current IRA Balance"),
        customers: measure(row, "Number of Customers"),
      }))
      .filter((row) => row.region)
      // By total deposits, not savings alone: the page ranks regions with a
      // proportional bar, and a bar order that disagrees with the row order
      // reads as a bug.
      .sort((a, b) => b.savings + b.checking + b.ira - (a.savings + a.checking + a.ira));

    return { rows, error: null };
  } catch (error) {
    console.error("Region balances searchData request failed", error);
    const detail = error instanceof Error ? error.message : "unknown error";
    return {
      rows: [],
      // searchdata needs CAN_DOWNLOAD_DETAILED_DATA even when a user only
      // queries their own RLS-scoped rows; code 10086 is that.
      error: detail.includes("10086")
        ? "ThoughtSpot refused the query. Grant CAN_DOWNLOAD_DETAILED_DATA to this user."
        : `Couldn't load balances: ${detail}`,
    };
  }
}
