import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BalancesClient from "@/components/BalancesClient";
import { getRegionBalances } from "@/lib/balances";
import { getCurrentUser } from "@/lib/thoughtspot-user";

export const metadata: Metadata = { title: "Balances — LedgerWise" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetched server-side with the searchdata REST API, as the signed-in user,
  // so RLS scopes which regions they see. The client's Refresh button
  // re-runs this via router.refresh() rather than holding a second cache.
  const { rows, error } = await getRegionBalances();

  return <BalancesClient user={user} rows={rows} error={error} />;
}
