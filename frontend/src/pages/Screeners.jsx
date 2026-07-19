import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Filter as FilterIcon, Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

const compact = (n) => n == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(n);
const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

const NL_PRESETS = [
  { name: "Undervalued Tech Leaders", q: "undervalued tech leaders with strong FCF and moats" },
  { name: "AI Infrastructure",         q: "AI infrastructure winners with pricing power" },
  { name: "Cash-Cow Compounders",       q: "durable compounders with high ROIC and steady margins" },
  { name: "Turnarounds",                q: "operational turnaround candidates" },
  { name: "Dividend Machines",          q: "reliable dividend growers with low payout ratio" },
];

const SECTORS = ["Technology","Financial Services","Healthcare","Consumer Cyclical","Consumer Defensive","Energy","Industrials","Utilities","Real Estate","Communication Services","Basic Materials"];

export default function Screeners() {
  const [q, setQ] = useState("");
  const [minCap, setMinCap] = useState("");
  const [maxPe, setMaxPe] = useState("");
  const [sector, setSector] = useState("");
  const [rows, setRows] = useState([]);
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState({ key: "market_cap", desc: true });
  const [saved, setSaved] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("saved_screens") || "[]")); } catch { setSaved([]); }
  }, []);

  const run = async (queryOverride) => {
    setBusy(true);
    try {
      const { data } = await api.post("/screener/run", {
        query: (queryOverride ?? q) || null,
        min_market_cap: minCap ? parseFloat(minCap) * 1e9 : null,
        max_pe: maxPe ? parseFloat(maxPe) : null,
        sector: sector || null,
      });
      setRows(data.results || []);
      setAi(data.ai_summary || null);
    } finally { setBusy(false); }
  };

  const saveScreen = () => {
    if (!q && !minCap && !maxPe && !sector) return toast.error("Nothing to save");
    const name = prompt("Name this screen:", q?.slice(0, 30) || "My Screen");
    if (!name) return;
    const entry = { name, q, minCap, maxPe, sector, at: Date.now() };
    const next = [entry, ...saved.filter(s => s.name !== name)].slice(0, 10);
    setSaved(next); localStorage.setItem("saved_screens", JSON.stringify(next));
    toast.success("Screen saved");
  };

  const loadScreen = (s) => { setQ(s.q || ""); setMinCap(s.minCap || ""); setMaxPe(s.maxPe || ""); setSector(s.sector || ""); };

  const sorted = [...rows].sort((a, b) => {
    const va = a[sort.key] ?? -Infinity, vb = b[sort.key] ?? -Infinity;
    return sort.desc ? vb - va : va - vb;
  });
  const setSortKey = (k) => setSort({ key: k, desc: sort.key === k ? !sort.desc : true });

  const clear = () => { setQ(""); setMinCap(""); setMaxPe(""); setSector(""); };

  return (
    <div className="p-6 space-y-4" data-testid="screener-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">AI Screener</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Natural language + filters · saved screens · sortable</p>
        </div>
      </div>

      {/* NL Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="overline mr-1">Presets</span>
        {NL_PRESETS.map(p => (
          <button key={p.name} onClick={() => { setQ(p.q); run(p.q); }}
            className="text-[10px] font-mono px-2 py-1 border border-line rounded text-muted-foreground hover:text-terminal hover:border-terminal transition-colors" data-testid={`sc-preset-${p.name.toLowerCase().replace(/\s+/g,'-')}`}>
            {p.name}
          </button>
        ))}
        {saved.length > 0 && (
          <>
            <span className="overline mx-2">Saved</span>
            {saved.map(s => (
              <button key={s.name} onClick={() => { loadScreen(s); }}
                className="text-[10px] font-mono px-2 py-1 border border-line rounded text-muted-foreground hover:text-terminal hover:border-terminal" title={s.name}>
                <BookmarkCheck className="w-3 h-3 inline mr-1" />{s.name.slice(0, 20)}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="border border-line bg-panel rounded-md p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-4 h-4 text-terminal" />
          <span className="overline flex-1">Query</span>
          <Button size="sm" variant="ghost" onClick={saveScreen} className="h-7 text-xs" data-testid="sc-save"><Bookmark className="w-3 h-3 mr-1" />Save</Button>
          <Button size="sm" variant="ghost" onClick={clear} className="h-7 text-xs" data-testid="sc-clear">Clear</Button>
        </div>
        <Input placeholder="e.g., 'Undervalued tech leaders with strong FCF and moats'" value={q} onChange={(e) => setQ(e.target.value)} className="bg-base border-line font-mono" data-testid="screener-query" />
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Min Market Cap ($B)" value={minCap} onChange={(e) => setMinCap(e.target.value)} className="bg-base border-line font-mono" />
          <Input placeholder="Max P/E" value={maxPe} onChange={(e) => setMaxPe(e.target.value)} className="bg-base border-line font-mono" />
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="bg-base border border-line rounded-md px-3 text-sm font-mono">
            <option value="">All sectors</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => run()} disabled={busy} data-testid="run-screener-btn">
            {busy ? "Running…" : "Run Screen"}
          </Button>
        </div>
      </div>

      {ai && <AIPanel result={ai} title="AI Screener Insight" />}

      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <div className="overline">Results ({rows.length})</div>
          <div className="text-[10px] font-mono text-muted-foreground">Sorted by <span className="text-terminal">{sort.key}</span> {sort.desc ? "↓" : "↑"}</div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-line">
              {[
                {k:"ticker", l:"Ticker"},{k:"name", l:"Name"},{k:"sector", l:"Sector"},
                {k:"market_cap", l:"Market Cap"},{k:"pe", l:"P/E"},{k:"dividend_yield", l:"Div Yld"},
                {k:"price", l:"Price"},{k:"change_pct", l:"Chg"}
              ].map(c => (
                <th key={c.k} onClick={() => setSortKey(c.k)}
                  className="text-right font-normal overline px-3 py-2 cursor-pointer hover:text-terminal">
                  {c.l}{sort.key === c.k && <span className="ml-1">{sort.desc ? "↓" : "↑"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.ticker} className="border-b border-line hover:bg-surface cursor-pointer" onClick={() => nav(`/company/${r.ticker}`)} data-testid={`screener-row-${r.ticker}`}>
                <td className="px-3 py-2 font-mono text-left">{r.ticker}</td>
                <td className="px-3 py-2 text-left truncate max-w-[180px]">{r.name}</td>
                <td className="px-3 py-2 text-left text-muted-foreground">{r.sector}</td>
                <td className="px-3 py-2 font-mono text-right">{compact(r.market_cap)}</td>
                <td className="px-3 py-2 font-mono text-right">{fmt(r.pe)}</td>
                <td className="px-3 py-2 font-mono text-right">{r.dividend_yield ? (r.dividend_yield * 100).toFixed(2) + "%" : "—"}</td>
                <td className="px-3 py-2 font-mono text-right">${fmt(r.price)}</td>
                <td className={`px-3 py-2 font-mono text-right ${pct(r.change_pct)}`}>{fmt(r.change_pct)}%</td>
              </tr>
            ))}
            {rows.length === 0 && !busy && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Click a preset or Run Screen to see results.</td></tr>}
            {busy && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground font-mono text-xs">› Screening universe…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
