"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetCachedAuthToken } from "@thoughtspot/visual-embed-sdk";
import { DEMO_INSTITUTION } from "@/lib/demoCopy";
import { signOut } from "@/lib/thoughtspot-auth";
import type { CurrentUser } from "@/lib/thoughtspot-user";

// `href: null` = set dressing. Filings and Lineage exist on the artboard but
// have no page behind them; they used to point at #anchors on /home, which
// meant clicking one from /analytics or /balances navigated away from what
// you were showing. Inert is the honest behaviour for a nav item that leads
// nowhere.
const NAV: Array<{ href: string | null; label: string; key: string }> = [
  { href: "/home", label: "Home", key: "home" },
  { href: "/analytics", label: "Analytics", key: "analytics" },
  { href: null, label: "Filings", key: "filings" },
  { href: "/balances", label: "Balances", key: "balances" },
  { href: null, label: "Lineage", key: "lineage" },
];

export default function AppHeader({
  user,
  active,
}: {
  user: CurrentUser;
  active: "home" | "analytics" | "balances";
}) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    // Same reason as on sign-in: the SDK's cached token outlives the app
    // session, so the next user would inherit this one's data.
    resetCachedAuthToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 20, background: "var(--lw-ink)", color: "var(--lw-paper)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18,
        flexWrap: "wrap", padding: "12px clamp(14px, 3vw, 40px)", borderBottom: "1.5px solid var(--lw-ink)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px, 2.2vw, 28px)", flexWrap: "wrap" }}>
        <Link href="/" className="lw-serif" style={{ fontSize: 24, color: "var(--lw-paper)", letterSpacing: "-0.01em" }}>
          LEDGERWISE
        </Link>
        <nav className="lw-mono lw-mono-sm" style={{ display: "flex", gap: "clamp(10px, 1.6vw, 20px)", flexWrap: "wrap" }}>
          {NAV.map((item) =>
            item.href === null ? (
              <span key={item.key} className="lw-navlink" data-inert>
                {item.label}
              </span>
            ) : (
              <Link key={item.key} href={item.href} className="lw-navlink" data-active={item.key === active}>
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>

      <div className="lw-mono" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--lw-muted-2)" }}>
        <span>{DEMO_INSTITUTION}</span>
        <button
          type="button"
          onClick={handleSignOut}
          title={`Sign out ${user.displayName}`}
          className="lw-mono"
          style={{
            width: 28, height: 28, border: "1.5px solid var(--lw-muted)", background: "transparent",
            color: "var(--lw-paper)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, borderRadius: 8, cursor: "pointer", letterSpacing: 0,
          }}
        >
          {user.initials}
        </button>
      </div>
    </header>
  );
}
