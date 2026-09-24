"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetCachedAuthToken } from "@thoughtspot/visual-embed-sdk";
import { signIn } from "@/lib/thoughtspot-auth";

// Optional convenience: a comma-separated list in NEXT_PUBLIC_DEMO_USERS
// renders as click-to-fill hints. Purely cosmetic — the cluster decides who
// can actually sign in, and nothing here grants access.
const DEMO_USERS = (process.env.NEXT_PUBLIC_DEMO_USERS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Sign-in. A quieter take than the "LedgerWise Login" artboard, by request:
 * one statement on the left, one form on the right, nothing animating.
 */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !pass) {
      setError("Enter your work email and passphrase.");
      return;
    }
    setError("");
    setStatus("sending");

    try {
      // Server action: mints a trusted-auth token for this email
      // (JIT-provisioning the ThoughtSpot user) and stores it httpOnly.
      const result = await signIn(email.trim());
      if (result.error) {
        setError(result.error);
        setStatus("idle");
        return;
      }
      // The SDK caches the last auth token on `window` and reuses it while
      // still valid, regardless of who is now signed in at the app level.
      // Without this, signing in as a different user inside that window
      // shows the PREVIOUS user's data until a hard reload.
      resetCachedAuthToken();
      router.push("/home");
      router.refresh();
    } catch {
      setError("Couldn't reach the sign-in service. Try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="lw-login">
      <aside className="lw-login-aside">
        <Link
          href="/"
          className="lw-serif"
          style={{ fontSize: 26, letterSpacing: "-0.01em", color: "var(--lw-paper)", alignSelf: "flex-start" }}
        >
          LEDGERWISE
        </Link>

        <div>
          <p
            className="lw-serif"
            style={{ fontSize: "clamp(30px, 3.2vw, 46px)", lineHeight: 1.05, margin: 0, maxWidth: "18ch", textWrap: "pretty" }}
          >
            Every figure, <span style={{ fontStyle: "italic", color: "var(--lw-blue-lt)" }}>traced</span> to its
            source row.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--lw-muted-2)", margin: "16px 0 0", maxWidth: "38ch", textWrap: "pretty" }}>
            Analytics and regulatory reporting for core banking — reconciled to the trial balance, every night.
          </p>
        </div>

        <div className="lw-mono lw-login-aside-bottom">
          <span>SOC 2 Type II</span>
          <span>FFIEC audited</span>
          <span>1,412 institutions</span>
        </div>
      </aside>

      <main className="lw-login-main">
        <form onSubmit={submit} className="lw-login-form" noValidate>
          <div>
            <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>Sign in</div>
            <h1 className="lw-serif" style={{ fontSize: "clamp(32px, 3.6vw, 44px)", lineHeight: 1, margin: "10px 0 0" }}>
              Welcome back.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--lw-muted)", margin: "10px 0 0" }}>
              Use your work email to continue.
            </p>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>Work email</span>
            <input
              type="email"
              className="lw-input lw-input-quiet"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@bank.com"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lw-mono" style={{ display: "flex", justifyContent: "space-between", gap: 12, letterSpacing: "0.14em", color: "var(--lw-muted)" }}>
              <span>Passphrase</span>
              <a href="#reset" style={{ letterSpacing: "0.14em" }}>Forgot?</a>
            </span>
            <input
              type="password"
              className="lw-input lw-input-quiet"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                border: "1.5px solid var(--lw-orange)", background: "var(--lw-err-bg)", color: "var(--lw-err-ink)",
                padding: "12px 14px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
              }}
            >
              <span style={{ width: 8, height: 8, marginTop: 5, background: "var(--lw-orange)", borderRadius: "50%", flex: "none" }} />
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="lw-btn lw-btn-primary"
            disabled={status === "sending"}
            style={{ padding: "17px 22px", justifyContent: "space-between", marginTop: 4 }}
          >
            <span>{status === "sending" ? "Signing in…" : "Sign in"}</span>
            <span aria-hidden>→</span>
          </button>

          <a href="#sso" style={{ fontSize: 13, textAlign: "center", marginTop: 2 }}>
            Use single sign-on instead
          </a>

          <p
            style={{
              fontSize: 12, lineHeight: 1.55, color: "var(--lw-muted)", margin: "14px 0 0",
              paddingTop: 14, borderTop: "1px solid var(--lw-rule)",
            }}
          >
            Demo environment — sign in with an existing ThoughtSpot account. The
            passphrase isn&rsquo;t checked; accounts are not created automatically.
          </p>

          {DEMO_USERS.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DEMO_USERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setEmail(name)}
                  className="lw-mono lw-mono-sm"
                  style={{
                    textAlign: "left", background: "transparent", border: "none", padding: 0,
                    cursor: "pointer", color: "var(--lw-blue)", letterSpacing: "0.04em", textTransform: "none",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </form>

        <div className="lw-login-foot lw-mono" style={{ color: "var(--lw-muted)" }}>
          <span>© 2026 LedgerWise Data Works</span>
          <span style={{ display: "flex", gap: 16 }}>
            <a href="#security">Security</a>
            <a href="#status">Status</a>
            <a href="#support">Support</a>
          </span>
        </div>
      </main>
    </div>
  );
}
