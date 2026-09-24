import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HomeClient from "@/components/HomeClient";
import { getCurrentUser } from "@/lib/thoughtspot-user";
import { closePhrase, statusDate } from "@/lib/demoClock";

export const metadata: Metadata = { title: "Home — LedgerWise" };

/** The artboard says "Good morning" — keep that, but tell the truth when a
 *  demo runs in the afternoon. Resolved on the server so the first paint is
 *  already correct and hydration has nothing to disagree about. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Page() {
  // A validated lookup, not just a cookie check: a dead or revoked token
  // returns null here and sends the user back to sign in.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Resolved here for the same reason as the greeting: a date computed in a
  // client component disagrees with itself across hydration.
  const now = new Date();
  return (
    <HomeClient
      user={user}
      greeting={greetingFor(now)}
      today={statusDate(now)}
      closeIn={closePhrase(now)}
    />
  );
}
