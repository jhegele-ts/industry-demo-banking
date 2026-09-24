export default function AppFooter() {
  return (
    <footer
      className="lw-mono"
      style={{
        borderTop: "1.5px solid var(--lw-ink)", padding: "16px clamp(14px, 4vw, 56px)",
        display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", color: "var(--lw-muted)",
      }}
    >
      <span>Last core sync 02:14 UTC · 11 platforms</span>
      <span>© 2026 LedgerWise Data Works</span>
    </footer>
  );
}
