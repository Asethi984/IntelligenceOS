import { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const compact = (n) => n == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(n);

export default function Valuation() {
  const [ticker, setTicker] = useState("AAPL");
  const [revenue, setRevenue] = useState("400000000000");
  const [growth, setGrowth] = useState("0.08");
  const [margin, setMargin] = useState("0.25");
  const [wacc, setWacc] = useState("0.09");
  const [terminal, setTerminal] = useState("0.025");
  const [years, setYears] = useState("5");
  const [shares, setShares] = useState("15600000000");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/valuation/dcf", {
        ticker, revenue: +revenue, growth_rate: +growth, margin: +margin,
        wacc: +wacc, terminal_growth: +terminal, years: parseInt(years),
        shares_outstanding: +shares
      });
      setResult(data);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="valuation-page">
      <h1 className="text-3xl font-light tracking-tighter">Valuation Lab · DCF</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 border border-line bg-panel rounded-md p-4 space-y-3">
          <div className="overline mb-2">Inputs</div>
          {[
            { l: "Ticker", v: ticker, s: setTicker },
            { l: "Revenue (current)", v: revenue, s: setRevenue },
            { l: "Growth rate (decimal)", v: growth, s: setGrowth },
            { l: "FCF margin (decimal)", v: margin, s: setMargin },
            { l: "WACC (decimal)", v: wacc, s: setWacc },
            { l: "Terminal growth (decimal)", v: terminal, s: setTerminal },
            { l: "Projection years", v: years, s: setYears },
            { l: "Shares outstanding", v: shares, s: setShares },
          ].map((f) => (
            <div key={f.l}>
              <Label className="overline">{f.l}</Label>
              <Input value={f.v} onChange={(e) => f.s(e.target.value)} className="mt-1 bg-base border-line font-mono" />
            </div>
          ))}
          <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={run} disabled={busy} data-testid="run-dcf-btn">
            {busy ? "Computing…" : "Compute DCF"}
          </Button>
        </div>
        <div className="col-span-7 space-y-4">
          {result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Fair Value/Share", v: "$" + fmt(result.fair_value_per_share) },
                  { l: "Current Price", v: "$" + fmt(result.current_price) },
                  { l: "Upside", v: fmt(result.upside_pct) + "%", c: result.upside_pct > 0 ? "text-positive" : "text-negative" },
                ].map(k => (
                  <div key={k.l} className="border border-line bg-panel rounded-md p-4">
                    <div className="overline mb-1">{k.l}</div>
                    <div className={`font-mono text-xl ${k.c || ""}`}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="border border-line bg-panel rounded-md overflow-hidden">
                <div className="overline px-4 py-2.5 border-b border-line">Scenarios</div>
                <table className="w-full text-xs">
                  <tbody>
                    {["bull","base","bear"].map(s => (
                      <tr key={s} className="border-b border-line">
                        <td className="px-4 py-2 uppercase text-xs">{s}</td>
                        <td className="px-4 py-2 font-mono text-right">${fmt(result.scenarios[s].fair_value)}</td>
                        <td className={`px-4 py-2 font-mono text-right ${result.scenarios[s].upside_pct > 0 ? "text-positive" : "text-negative"}`}>{fmt(result.scenarios[s].upside_pct)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border border-line bg-panel rounded-md overflow-hidden">
                <div className="overline px-4 py-2.5 border-b border-line">Projected FCF</div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-line text-muted-foreground"><th className="text-left px-4 py-2 overline font-normal">Year</th><th className="text-right px-4 py-2 overline font-normal">FCF</th><th className="text-right px-4 py-2 overline font-normal">PV</th></tr></thead>
                  <tbody>
                    {result.projections.map(p => (
                      <tr key={p.year} className="border-b border-line">
                        <td className="px-4 py-2 font-mono">Y{p.year}</td>
                        <td className="px-4 py-2 font-mono text-right">{compact(p.fcf)}</td>
                        <td className="px-4 py-2 font-mono text-right">{compact(p.pv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!result && <div className="border border-line border-dashed bg-panel/50 rounded-md p-12 text-center text-xs text-muted-foreground">Configure inputs and compute DCF to see valuation.</div>}
        </div>
      </div>
    </div>
  );
}
