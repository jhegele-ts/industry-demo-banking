import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/thoughtspot-user";

export const metadata: Metadata = { title: "Log in — LedgerWise" };

export default async function Page() {
  // Validated, not cookie-presence: only bounce on when the stored token
  // actually resolves to a user. A presence check here would ping-pong with
  // the page's own redirect whenever the cookie outlived its token.
  const user = await getCurrentUser();
  if (user) redirect("/home");

  return <LoginForm />;
}
