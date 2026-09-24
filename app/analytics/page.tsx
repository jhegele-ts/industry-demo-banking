import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AnalyticsClient from "@/components/AnalyticsClient";
import { getFilterColumns } from "@/lib/filterColumns";
import { getCurrentUser } from "@/lib/thoughtspot-user";
import { extractStamp } from "@/lib/demoClock";

export const metadata: Metadata = { title: "Analytics — LedgerWise" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // OpenFilter needs column GUIDs, which the liveboard TML doesn't carry —
  // resolve them from the model's metadata instead of hand-maintaining them.
  const filters = await getFilterColumns();

  return <AnalyticsClient user={user} filters={filters} extract={extractStamp(new Date())} />;
}
