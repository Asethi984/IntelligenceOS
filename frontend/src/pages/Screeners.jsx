import { useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const compact = (n) => n == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(n);
const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

export default function Screeners() {
  const [q, setQ] = useState("");
  const [minCap, setMinCap] = useState("");
  const [maxPe, setMaxPe] = useState("");
  const [sector, setSector] = useState("");
  const [rows, setRows] = useState([]);
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/screener/run", {
        query: q || null,
        min_market_cap: minCap ? parseFloat(minCap) * 1e9 : null,
        max_pe: maxPe ? parseFloat(maxPe) : null,
        sector: sector || null,
      });
      setRows(data.results || []);
      setAi(data.ai_summary || null);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="screener-page">
      <h1 className="text-3xl font-light tracking-tighter">AI Screener</h1>
      <div className="border border-line bg-panel rounded-md p-4 space-y-3">
        <div className="overline">Natural Language + Filters</div>
        <Input placeholder="e.g., 'Undervalued tech leaders with strong FCF and moats'" value={q} onChange={(e) => setQ(e.target.value)} className="bg-base border-line font-mono" data-testid="screener-query" />
        <div className="grid grid-cols-4 gap-2">
          <Input placeholder="Min Market Cap ($B)" value={minCap} onChange={(e) => setMinCap(e.target.value)} className="bg-base border-line font-mono" />
          <Input placeholder="Max P/E" value={maxPe} onChange={(e) => setMaxPe(e.target.value)} className="bg-base border-line font-mono" />
          <Input placeholder="Sector (Technology, Energy, …)" value={sector} onChange={(e) => setSector(e.target.value)} className="bg-base border-line font-mono col-span-2" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={run} disabled={busy} data-testid="run-screener-btn">{busy ? "Running…" : "Run Screen"}</Button>
        </div>
      </div>

      {ai && <AIPanel result={ai} title="AI Screener Insight" />}

      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <div className="overline px-4 py-2.5 border-b border-line">Results ({rows.length})</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-line">
              {["Ticker","Name","Sector","Market Cap","P/E","Div Yld","Price","Chg"].map(h => <th key={h} className="text-right font-normal overline px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ticker} className="border-b border-line hover:bg-surface cursor-pointer" onClick={() => nav(`/company/${r.ticker}`)} data-testid={`screener-row-${r.ticker}`}>
                <td className="px-3 py-2 font-mono text-left">{r.ticker}</td>
                <td className="px-3 py-2 text-left">{r.name}</td>
                <td className="px-3 py-2 text-left text-muted-foreground">{r.sector}</td>
                <td className="px-3 py-2 font-mono text-right">{compact(r.market_cap)}</td>
                <td className="px-3 py-2 font-mono text-right">{fmt(r.pe)}</td>
                <td className="px-3 py-2 font-mono text-right">{r.dividend_yield ? (r.dividend_yield * 100).toFixed(2) + "%" : "—"}</td>
                <td className="px-3 py-2 font-mono text-right">${fmt(r.price)}</td>
                <td className={`px-3 py-2 font-mono text-right ${pct(r.change_pct)}`}>{fmt(r.change_pct)}%</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Run screen to see results.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
