/**
 * The "placeholder geometry" block from the Analytics artboard. Shown in
 * place of the real embed whenever a board tab has no GUID configured, so
 * the page still reads correctly before the cluster details are filled in.
 */
const KPIS = [
  { label: "Current mortgage loan balance", value: "$81.77M" },
  { label: "Total customer count", value: "200K" },
  { label: "Current savings balance", value: "$1.08B" },
  { label: "Total checking balance", value: "$962.14M" },
];

const WELLS = [
  { title: "Region to product alignment", note: "Sankey · region → product" },
  { title: "Balance type by customer age group", note: "Stacked bars · IRA, savings, checking" },
];

export default function LiveboardPlaceholder({ envVar }: { envVar: string }) {
  return (
    <div
      style={{
        padding: "clamp(14px, 2vw, 20px)", display: "flex", flexDirection: "column", gap: 14,
        background: "repeating-linear-gradient(135deg, #E9E4D6 0 10px, #F2EFE7 10px 20px)",
      }}
    >
      <div style={{ border: "1.5px dashed var(--lw-muted)", borderRadius: 8, padding: 14, background: "rgba(242, 239, 231, 0.7)" }}>
        <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>Key metrics</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
          {KPIS.map((kpi) => (
            <div
              key={kpi.label}
              style={{
                border: "1.5px solid var(--lw-ink)", borderRadius: 8, background: "var(--lw-ink)",
                color: "var(--lw-paper)", padding: 16, minHeight: 104,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}
            >
              <span className="lw-mono" style={{ letterSpacing: "0.1em", color: "var(--lw-muted-2)", lineHeight: 1.5 }}>{kpi.label}</span>
              <span className="lw-serif" style={{ fontSize: "clamp(26px, 2.8vw, 38px)", lineHeight: 1, letterSpacing: 0 }}>{kpi.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: "1.5px dashed var(--lw-muted)", borderRadius: 8, padding: 14, background: "rgba(242, 239, 231, 0.7)" }}>
        <div className="lw-mono" style={{ letterSpacing: "0.14em", color: "var(--lw-muted)" }}>Regional analysis</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {WELLS.map((well) => (
            <div
              key={well.title}
              style={{
                border: "1.5px solid var(--lw-rule)", borderRadius: 8, background: "var(--lw-paper)", minHeight: 230,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, padding: 20, textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5, height: 46 }}>
                <span style={{ width: 8, height: "38%", background: "var(--lw-blue-lt)", borderRadius: 2 }} />
                <span style={{ width: 8, height: "62%", background: "var(--lw-blue)", borderRadius: 2 }} />
                <span style={{ width: 8, height: "100%", background: "var(--lw-ink)", borderRadius: 2 }} />
                <span style={{ width: 8, height: "74%", background: "var(--lw-orange)", borderRadius: 2 }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{well.title}</span>
              <span className="lw-mono" style={{ letterSpacing: "0.1em", color: "var(--lw-muted)", lineHeight: 1.6, maxWidth: "34ch" }}>{well.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lw-mono" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", color: "var(--lw-muted)" }}>
        <span>Placeholder geometry — replaced by the live embed</span>
        <span style={{ textTransform: "none", letterSpacing: "0.06em" }}>set {envVar}</span>
      </div>
    </div>
  );
}
