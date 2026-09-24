/**
 * /analytics embeds ONE liveboard and switches between its native tabs with
 * HostEvent.SetActiveTab, rather than mounting a different liveboard per tab.
 * That keeps the iframe alive across a tab change, so any filters the user
 * set on the liveboard survive — remounting would wipe them.
 *
 * Tab and column identifiers are ThoughtSpot GUIDs, not display names.
 */
export const LIVEBOARD_ID = process.env.NEXT_PUBLIC_LIVEBOARD_ID ?? "";

export interface BoardTab {
  key: string;
  name: string;
  tabId: string;
}

export const BOARD_TABS: BoardTab[] = [
  { key: "overview", name: "Overview", tabId: process.env.NEXT_PUBLIC_TAB_ID_OVERVIEW ?? "" },
  { key: "customer", name: "Customer insights", tabId: process.env.NEXT_PUBLIC_TAB_ID_CUSTOMER ?? "" },
  { key: "product", name: "Product performance", tabId: process.env.NEXT_PUBLIC_TAB_ID_PRODUCT ?? "" },
  // There was a fourth, "Regulatory variance". It was an artboard invention
  // pointing at the liveboard's real Balances tab, so it promised variance
  // analysis the data cannot do and duplicated what /balances already shows
  // per region, with the insight tile. Renaming it to "Balances" would have
  // put one label on two different views. The liveboard's only other real tab
  // is "Demo Script", which prospects should not see.
];

/** GUID of the data model Marginal is locked to, and that /balances queries
 *  through the searchdata REST API. */
export const SPOTTER_MODEL_ID = process.env.NEXT_PUBLIC_SPOTTER_MODEL_ID ?? "";

/** The liveboard tab /balances embeds, once per expanded region. Same
 *  liveboard as /analytics, pinned to its Balances tab. */
export const BALANCES_TAB_ID = process.env.NEXT_PUBLIC_TAB_ID_BALANCES ?? "";

/** Runtime filters address columns by NAME, unlike HostEvent.OpenFilter which
 *  needs a GUID. Confirmed against Banking_Liveboard.yaml. */
export const REGION_COLUMN = "Customer Region";
