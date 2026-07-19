import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, TrendingUp } from "lucide-react";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pctColor = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

const RATING_META = {
  STRONG_BUY: { color: "text-positive border-positive bg-positive/10", label: "STRONG BUY" },
  BUY: { color: "text-positive border-positive/60", label: "BUY" },
  HOLD: { color: "text-warning border-warning/60", label: "HOLD" },
  SELL: { color: "text-negative border-negative/60", label: "SELL" },
  STRONG_SELL: { color: "text-negative border-negative bg-negative/10", label: "STRONG SELL" },
};

const UNIVERSE_PRESETS = {
  "AI Leaders": ["NVDA","MSFT","GOOGL","META","AMD","PLTR","ANET","AVGO"],
  "Mag 7": ["AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA"],
  "Dividend Aristocrats": ["JNJ","PG","KO","PEP","MCD","WMT","MMM","XOM"],
  "Value Plays": ["BRK-B","JPM","BAC","V","MA","UNH","HD"],
  "Crypto & ETFs": ["BTC-USD","ETH-USD","SPY","QQQ","VTI"],
};

function ScoreBar({ label, value, color = "bg-terminal" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[10px] w-8 text-right">{value}</span>
    </div>
  );
}

export default function Ratings() {
  const [tickers, setTickers] = useState("NVDA,MSFT,AAPL,GOOGL,META,AMZN,TSLA,AMD");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [aiRat, setAiRat] = useState(false);
  const [sort, setSort] = useState({ key: "overall", desc: true });
  const nav = useNavigate();

  const run = async () => {
    const list = tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!list.length) return;
    setBusy(true); setRows([]);
    try {
      const { data } = await api.post("/ratings", { tickers: list, ai_rationale: aiRat });
      setRows(data.ratings || []);
    } finally { setBusy(false); }
  };

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...rows].sort((a, b) => {
    const va = a[sort.key] ?? -Infinity, vb = b[sort.key] ?? -Infinity;
    return sort.desc ? vb - va : va - vb;
  });
  const setSortKey = (k) => setSort({ key: k, desc: sort.key === k ? !sort.desc : true });

  return (
    <div className="p-6 space-y-4" data-testid="ratings-page">
      <div>
        <h1 className="text-3xl font-light tracking-tighter">Buy · Sell · Hold</h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">Deterministic attractiveness score (value + momentum + quality + sentiment) with optional AI rationale</p>
      </div>

      <div className="border border-line bg-panel rounded-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="overline flex-1">Universe</div>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(UNIVERSE_PRESETS).map(([name, list]) => (
              <button key={name} onClick={() => setTickers(list.join(","))}
                className="text-[10px] font-mono px-2 py-1 border border-line rounded text-muted-foreground hover:text-terminal hover:border-terminal" data-testid={`preset-${name.replace(/\s+/g,'-').toLowerCase()}`}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Input value={tickers} onChange={(e) => setTickers(e.target.value.toUpperCase())} placeholder="AAPL,NVDA,MSFT..." className="bg-base border-line font-mono flex-1" data-testid="ratings-tickers-input" />
          <label className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={aiRat} onChange={(e) => setAiRat(e.target.checked)} className="accent-terminal" data-testid="ai-rationale-toggle" />
            <Sparkles className="w-3 h-3" /> AI rationale
          </label>
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={run} disabled={busy} data-testid="run-ratings-btn">
            {busy ? "Scoring…" : "Run Ratings"}
          </Button>
        </div>
      </div>

      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-line">
              <th className="text-left font-normal overline px-4 py-2 cursor-pointer" onClick={() => setSortKey("ticker")}>Symbol</th>
              <th className="text-left font-normal overline px-3 py-2">Sector</th>
              <th className="text-right font-normal overline px-3 py-2 cursor-pointer" onClick={() => setSortKey("price")}>Price</th>
              <th className="text-right font-normal overline px-3 py-2 cursor-pointer" onClick={() => setSortKey("change_pct")}>Chg %</th>
              <th className="text-right font-normal overline px-3 py-2 cursor-pointer" onClick={() => setSortKey("overall")}>Score ↕</th>
              <th className="text-center font-normal overline px-3 py-2">Rating</th>
              <th className="text-left font-normal overline px-3 py-2 w-64">Components</th>
              <th className="text-left font-normal overline px-3 py-2">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const M = RATING_META[r.rating] || RATING_META.HOLD;
              return (
                <tr key={r.ticker} className="border-b border-line hover:bg-surface cursor-pointer" onClick={() => nav(`/company/${r.ticker}`)} data-testid={`rating-row-${r.ticker}`}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm">{r.ticker}</div>
                    <div className="text-[10px] text-muted-foreground">{r.name}</div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{r.sector || "—"}</td>
                  <td className="px-3 py-3 font-mono text-right">${fmt(r.price)}</td>
                  <td className={`px-3 py-3 font-mono text-right ${pctColor(r.change_pct)}`}>{fmt(r.change_pct)}%</td>
                  <td className="px-3 py-3 font-mono text-right text-lg">
                    <span className={r.overall >= 60 ? "text-positive" : r.overall >= 45 ? "text-warning" : "text-negative"}>{r.overall}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-mono tracking-widest ${M.color}`}>{M.label}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <ScoreBar label="Value" value={r.components?.value || 0} color="bg-positive" />
                      <ScoreBar label="Momentum" value={r.components?.momentum || 0} color="bg-terminal" />
                      <ScoreBar label="Quality" value={r.components?.quality || 0} color="bg-insight" />
                      <ScoreBar label="Sentiment" value={r.components?.sentiment || 0} color="bg-warning" />
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-md">
                    {r.ai_rationale ? <span className="text-[11px] leading-relaxed text-muted-foreground">{r.ai_rationale}</span> : <span className="text-[10px] text-muted-foreground/60">enable AI rationale</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !busy && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No results. Click Run Ratings.</td></tr>}
            {busy && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-xs">› Computing scores across universe…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
