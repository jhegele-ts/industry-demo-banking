"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/* The page as a ledger sheet: ruled paper, a posting reference where a
   formula bar would sit, a numbered rail, and schedule tabs along the
   bottom. Copy is still the artboard's; the composition is not. */

const COVERAGE_ROWS = [
  { num: "01", title: "Filings, not exports", body: "Call Report, 5300, HMDA LAR and 1071 assembled from the core's own ledger — validated against the current edit checks before anyone signs." },
  { num: "02", title: "Four hundred banks, one build", body: "Package a report once, publish it to every institution on your platform, and let each one brand, schedule and slice it without a support ticket." },
  { num: "03", title: "Lineage on every cell", body: "Click a number, get the join path, the extract timestamp and the account rows behind it. Examiner questions answered in the meeting." },
  { num: "04", title: "Restatements without archaeology", body: "Point-in-time snapshots mean last March's report still renders like last March, even after three conversions and a merger." },
];

const CORES = ["NUCLEUS", "CORESTONE", "ALTAMIRA", "JOIST", "OPENLEDGER", "TANDEM CU", "MERIDIAN-9", "LEGACY AS/400", "FLAT-FILE DROP"];

const STEPS = [
  { n: "1", kicker: "week one", title: "Point us at the core", body: "Read-only credentials or a nightly drop. No conversion, no migration, no downtime window." },
  { n: "2", kicker: "week two", title: "We map the schema", body: "Your account models get normalized and reconciled to the trial balance, to the penny, in front of you." },
  { n: "3", kicker: "ongoing", title: "Close on autopilot", body: "Reports build overnight. Your team reviews exceptions instead of rebuilding spreadsheets." },
];

const STATS = [
  { v: "2 hrs", k: "median quarterly close" },
  { v: "11", k: "core platforms mapped" },
  { v: "1,400+", k: "institutions reporting" },
  { v: "0", k: "restatements since 2023" },
];

const TICKER = "FFIEC 031/041 · NCUA 5300 · HMDA LAR · BSA/SAR · 1071 SMALL BUSINESS · FR Y-9C · CECL ROLLFORWARD · REG DD APY · TRID TOLERANCE · SCHEDULE RC-C · ";

const AGE_BARS = [
  { s: 31, c: 26 }, { s: 68, c: 55 }, { s: 79, c: 77 },
  { s: 97, c: 91 }, { s: 100, c: 87 }, { s: 98, c: 86 },
];

/** Ease a numeric value up from zero, preserving prefix/suffix ("$1.08B"). */
function countUp(el: HTMLElement) {
  const node = el as HTMLElement & { _counted?: boolean };
  if (node._counted) return;
  node._counted = true;

  const raw = (el.textContent || "").trim();
  const match = raw.match(/[\d,]*\.?\d+/);
  if (!match) return;
  const numStr = match[0];
  const target = parseFloat(numStr.replace(/,/g, ""));
  if (!isFinite(target)) return;

  const decimals = (numStr.split(".")[1] || "").length;
  const grouped = numStr.includes(",");
  const pre = raw.slice(0, match.index);
  const post = raw.slice((match.index ?? 0) + numStr.length);
  const start = performance.now();

  const format = (value: number) => {
    let out = value.toFixed(decimals);
    if (grouped) {
      const parts = out.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      out = parts.join(".");
    }
    return pre + out + post;
  };

  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / 1100);
    el.textContent = p < 1 ? format(target * (1 - Math.pow(1 - p, 3))) : raw;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const seen = new Map<Element | null, number>();
    els.forEach((el) => {
      const parent = el.parentElement;
      const index = seen.get(parent) ?? 0;
      seen.set(parent, index + 1);
      el.dataset.delay = String(index * 90);
      el.classList.add("lw-armed");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          window.setTimeout(() => {
            el.classList.add("lw-shown");
            if (el.hasAttribute("data-count")) countUp(el);
            el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
          }, Number(el.dataset.delay ?? 0));
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="lw-land">
      {/* --- posting reference, where a formula bar would be --------------- */}
      <div className="lw-postbar">
        <span style={{ color: "var(--lw-ink)", fontWeight: 500 }}>1.a</span>
        <span style={{ color: "var(--lw-rule)" }}>│</span>
        <span>
          <span style={{ color: "var(--lw-blue)" }}>=TIE_OUT</span>
          (core, trial_balance) → 0.00% variance
        </span>
      </div>

      {/* --- masthead ------------------------------------------------------ */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 24, flexWrap: "wrap",
          padding: "16px clamp(16px, 4vw, 48px)", borderBottom: "1.5px solid var(--lw-ink)",
          background: "var(--lw-paper)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span className="lw-serif" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>LEDGERWISE</span>
          <span className="lw-mono" style={{ letterSpacing: "0.14em", border: "1px solid var(--lw-ink)", padding: "3px 6px", borderRadius: 6 }}>
            analytics + ai
          </span>
        </div>
        <nav className="lw-mono lw-mono-lg" style={{ display: "flex", alignItems: "center", gap: "clamp(14px, 2.2vw, 28px)", flexWrap: "wrap" }}>
          <a href="#coverage" style={{ color: "var(--lw-ink)" }}>Coverage</a>
          <a href="#cores" style={{ color: "var(--lw-ink)" }}>Cores</a>
          <a href="#how" style={{ color: "var(--lw-ink)" }}>How it works</a>
          <Link href="/login" className="lw-btn lw-btn-primary" style={{ fontSize: 12, padding: "12px 20px" }}>
            Log in <span aria-hidden>→</span>
          </Link>
        </nav>
      </header>

      {/* --- hero, on ruled ground ----------------------------------------- */}
      <section className="lw-ruled" style={{ position: "relative", borderBottom: "1.5px solid var(--lw-ink)", overflow: "hidden" }}>
        <div className="lw-rail" aria-hidden>
          <span className="lw-rail-text">Sheet 01</span>
          <span className="lw-rail-text">FY26 · posted</span>
        </div>

        <div
          className="lw-land-body"
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
            gap: "clamp(24px, 4vw, 56px)", alignItems: "center",
            padding: "clamp(36px, 6vw, 84px) clamp(16px, 4vw, 56px)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div data-reveal className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.18em", color: "var(--lw-muted)" }}>
              Core banking · analytics &amp; regulatory reporting
            </div>

            <h1
              data-reveal
              className="lw-serif"
              style={{ fontSize: "clamp(52px, 8.6vw, 132px)", lineHeight: 0.84, margin: "20px 0 0", textWrap: "balance" }}
            >
              Your core holds<br />
              the <span className="lw-hl">truth</span>.
            </h1>
            <p
              data-reveal
              className="lw-serif"
              style={{ fontStyle: "italic", fontSize: "clamp(26px, 3.6vw, 52px)", lineHeight: 1, margin: "14px 0 0", color: "var(--lw-ink-2)" }}
            >
              LedgerWise does the math.
            </p>

            <p data-reveal style={{ maxWidth: "44ch", fontSize: "clamp(15px, 1.2vw, 18px)", lineHeight: 1.55, color: "var(--lw-ink-2)", margin: "26px 0 0", textWrap: "pretty" }}>
              One analytics and reporting layer on top of every core you run — it benchmarks the
              portfolio, files the Call Report, the 5300 and the HMDA LAR, and builds the 300
              client-facing decks nobody wants to build twice.
            </p>

            <div data-reveal style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
              <Link href="/login" className="lw-btn lw-btn-primary">Log in <span aria-hidden>→</span></Link>
              <a href="#demo" className="lw-btn lw-btn-outline">Book a teardown</a>
            </div>
          </div>

          {/* tilted cards floating over the rules */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div data-reveal className="lw-tilt lw-tilt-a" style={{ padding: "18px 20px" }}>
              <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>Current mortgage loan balance</div>
              <div className="lw-serif" data-count style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 0.95, marginTop: 8 }}>$81.77M</div>
              <div className="lw-mono" style={{ color: "var(--lw-blue)", marginTop: 6, textTransform: "none", letterSpacing: "0.04em" }}>+1.7% vs. prior statement</div>
            </div>

            <div data-reveal className="lw-tilt lw-tilt-b" style={{ overflow: "hidden" }}>
              <div className="lw-mono" style={{ display: "flex", justifyContent: "space-between", gap: 10, background: "var(--lw-ink)", color: "var(--lw-paper)", padding: "10px 14px" }}>
                <span>Balance by age group</span>
                <span style={{ opacity: 0.7 }}>stmt. 09/2026</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 92, borderBottom: "1.5px solid var(--lw-ink)" }}>
                  {AGE_BARS.map((bar, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
                      <div style={{ flex: 1, height: `${bar.s}%`, background: "var(--lw-blue)" }} />
                      <div style={{ flex: 1, height: `${bar.c}%`, background: "var(--lw-orange)" }} />
                    </div>
                  ))}
                </div>
                <div className="lw-mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, letterSpacing: 0, textTransform: "none", color: "var(--lw-muted)" }}>
                  <span>18–24</span><span>65+</span>
                </div>
              </div>
            </div>

            <div data-reveal className="lw-tilt lw-tilt-c" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, background: "var(--lw-ink)", color: "var(--lw-paper)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--lw-blue-lt)", flex: "none" }} />
              <span className="lw-mono" style={{ color: "var(--lw-paper)", letterSpacing: "0.1em" }}>
                1,412 institutions reconciled · 02:14 UTC
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- ticker -------------------------------------------------------- */}
      <div style={{ borderBottom: "1.5px solid var(--lw-ink)", background: "var(--lw-ink)", color: "var(--lw-paper)", overflow: "hidden", padding: "13px 0" }}>
        <div className="lw-marquee-x lw-mono" style={{ display: "flex", width: "max-content", fontSize: 13, letterSpacing: "0.14em" }}>
          <span style={{ paddingRight: 28 }}>{TICKER.repeat(2)}</span>
          <span style={{ paddingRight: 28 }}>{TICKER.repeat(2)}</span>
        </div>
      </div>

      {/* --- proof --------------------------------------------------------- */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderBottom: "1.5px solid var(--lw-ink)" }}>
        {STATS.map((stat) => (
          <div key={stat.k} data-reveal style={{ padding: "clamp(22px, 3vw, 38px) clamp(16px, 2.4vw, 32px)", borderRight: "1px solid var(--lw-rule)", minWidth: 0 }}>
            <div className="lw-serif" data-count style={{ fontSize: "clamp(34px, 3.8vw, 54px)", lineHeight: 0.9 }}>{stat.v}</div>
            <div className="lw-mono" style={{ color: "var(--lw-muted)", marginTop: 10, lineHeight: 1.5 }}>{stat.k}</div>
          </div>
        ))}
      </section>

      {/* --- coverage ------------------------------------------------------ */}
      <section id="coverage" style={{ padding: "clamp(40px, 6vw, 92px) clamp(16px, 4vw, 56px)", borderBottom: "1.5px solid var(--lw-ink)", scrollMarginTop: 70 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap", borderBottom: "1.5px solid var(--lw-ink)", paddingBottom: 14 }}>
          <h2 data-reveal className="lw-serif" style={{ fontSize: "clamp(30px, 4.4vw, 58px)", lineHeight: 1, margin: 0 }}>
            What a reporting suite<br />actually has to survive
          </h2>
          <span className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>§ 01 — coverage</span>
        </div>
        {COVERAGE_ROWS.map((row) => (
          <div key={row.num} data-reveal className="lw-coverage-row" style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1.1fr) minmax(0, 1.4fr)", gap: "clamp(12px, 3vw, 40px)", alignItems: "start", padding: "clamp(20px, 2.6vw, 32px) 0", borderBottom: "1px solid var(--lw-rule)" }}>
            <div className="lw-mono lw-mono-lg" style={{ letterSpacing: "0.1em", color: "var(--lw-orange)", paddingTop: 6 }}>{row.num}</div>
            <h3 className="lw-serif" style={{ fontSize: "clamp(22px, 2.6vw, 34px)", lineHeight: 1.05, margin: 0 }}>{row.title}</h3>
            <p style={{ fontSize: "clamp(14px, 1.15vw, 17px)", lineHeight: 1.55, color: "var(--lw-ink-2)", margin: 0, maxWidth: "56ch", textWrap: "pretty" }}>{row.body}</p>
          </div>
        ))}
      </section>

      {/* --- cores --------------------------------------------------------- */}
      <section id="cores" className="lw-ruled" style={{ padding: "clamp(36px, 5vw, 78px) clamp(16px, 4vw, 56px)", borderBottom: "1.5px solid var(--lw-ink)", background: "var(--lw-paper-2)", scrollMarginTop: 70 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(24px, 4vw, 60px)", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <span className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>§ 02 — cores</span>
            <h2 data-reveal className="lw-serif" style={{ fontSize: "clamp(30px, 4.4vw, 56px)", lineHeight: 1, margin: "14px 0 0" }}>
              Core-agnostic on <span style={{ fontStyle: "italic", color: "var(--lw-blue)" }}>purpose.</span>
            </h2>
            <p style={{ fontSize: "clamp(15px, 1.2vw, 18px)", lineHeight: 1.55, color: "var(--lw-ink-2)", maxWidth: "44ch", margin: "18px 0 0", textWrap: "pretty" }}>
              Read-only connectors, nightly extracts, or a live feed — LedgerWise normalizes eleven
              account models into one schema and tells you, per field, where the number came from.
            </p>
          </div>
          <div data-reveal style={{ display: "flex", flexWrap: "wrap", gap: 10, minWidth: 0 }}>
            {CORES.map((core) => <span key={core} className="lw-core-chip">{core}</span>)}
          </div>
        </div>
      </section>

      {/* --- how it works -------------------------------------------------- */}
      <div id="how" className="lw-mono lw-mono-sm" style={{ padding: "clamp(28px, 4vw, 56px) clamp(16px, 4vw, 56px) 0", letterSpacing: "0.14em", color: "var(--lw-muted)", scrollMarginTop: 70 }}>
        § 03 — how it works
      </div>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", borderBottom: "1.5px solid var(--lw-ink)" }}>
        {STEPS.map((step) => (
          <div key={step.n} data-reveal style={{ padding: "clamp(26px, 3.4vw, 48px) clamp(18px, 2.6vw, 40px)", borderRight: "1px solid var(--lw-rule)", borderBottom: "1px solid var(--lw-rule)", minWidth: 0 }}>
            <div className="lw-serif" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.8, color: "var(--lw-blue)" }}>{step.n}</div>
            <div className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)", marginTop: 18 }}>{step.kicker}</div>
            <h3 style={{ fontWeight: 600, fontSize: "clamp(19px, 1.7vw, 23px)", lineHeight: 1.2, margin: "8px 0 0" }}>{step.title}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--lw-ink-2)", margin: "10px 0 0", textWrap: "pretty" }}>{step.body}</p>
          </div>
        ))}
      </section>

      {/* --- quote --------------------------------------------------------- */}
      <section style={{ padding: "clamp(40px, 6vw, 92px) clamp(16px, 4vw, 56px)", borderBottom: "1.5px solid var(--lw-ink)" }}>
        <blockquote data-reveal style={{ margin: 0, maxWidth: "26ch" }}>
          <p className="lw-serif" style={{ fontSize: "clamp(28px, 4.6vw, 62px)", lineHeight: 1.05, margin: 0, textWrap: "balance" }}>
            &ldquo;We used to staff a war room for the quarterly close.&rdquo;
          </p>
          <footer className="lw-mono lw-mono-sm" style={{ color: "var(--lw-muted)", marginTop: 22, maxWidth: "none" }}>
            VP, regulatory ops — top-40 core processor, 480 institutions
          </footer>
        </blockquote>
      </section>

      {/* --- CTA ----------------------------------------------------------- */}
      <section id="demo" style={{ background: "var(--lw-blue)", color: "var(--lw-paper)", padding: "clamp(44px, 7vw, 104px) clamp(16px, 4vw, 56px)", borderBottom: "1.5px solid var(--lw-ink)", scrollMarginTop: 70 }}>
        <div className="lw-mono lw-mono-sm" style={{ letterSpacing: "0.16em", opacity: 0.85 }}>§ 04 — get started</div>
        <h2 data-reveal className="lw-serif" style={{ fontSize: "clamp(38px, 7vw, 92px)", lineHeight: 0.92, margin: "18px 0 0", maxWidth: "20ch", textWrap: "pretty" }}>
          Bring us your ugliest report. We&rsquo;ll rebuild it in a week.
        </h2>
        <div data-reveal style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
          <Link href="/login" className="lw-btn" style={{ background: "var(--lw-paper)", color: "var(--lw-ink)", borderColor: "var(--lw-paper)" }}>
            Log in <span aria-hidden>→</span>
          </Link>
          <a href="#demo" className="lw-btn" style={{ background: "transparent", color: "var(--lw-paper)", borderColor: "var(--lw-paper)" }}>Book a teardown</a>
        </div>
      </section>

      <footer style={{ padding: "clamp(24px, 3vw, 40px) clamp(16px, 4vw, 56px)", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div className="lw-serif" style={{ fontSize: 24 }}>LEDGERWISE</div>
          <div className="lw-mono" style={{ color: "var(--lw-muted)", marginTop: 6 }}>
            Analytics &amp; reporting infrastructure for core banking · SOC 2 Type II · Kansas City
          </div>
        </div>
        <div className="lw-mono" style={{ color: "var(--lw-muted)" }}>© 2026 LedgerWise Data Works</div>
      </footer>

      {/* --- schedule tabs, pinned ----------------------------------------- */}
      <nav className="lw-statusbar" aria-label="Sections">
        <a href="#coverage">§01 Coverage</a>
        <a href="#cores">§02 Cores</a>
        <a href="#how">§03 How it works</a>
        <a href="#demo">§04 Get started</a>
        <span className="lw-statusbar-end">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lw-blue)" }} />
          Reconciled · 0.00% variance
        </span>
      </nav>
    </div>
  );
}
