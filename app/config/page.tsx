import type { Metadata } from "next";
import ConfigClient from "@/components/ConfigClient";

export const metadata: Metadata = { title: "Demo config — LedgerWise", robots: { index: false } };

/**
 * Internal demo controls. Deliberately unauthenticated and unlinked: every
 * setting lives in the demoer's own browser (localStorage), there is nothing
 * sensitive here, and it's useful to set up before signing in.
 */
export default function Page() {
  return <ConfigClient />;
}
