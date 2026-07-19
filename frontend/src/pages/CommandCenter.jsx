import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Activity, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pctColor = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

function Widget({ title, right, children, className = "" }) {
  return (
    <div className={`border border-line bg-panel rounded-md ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <div className="overline">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function CommandCenter() {
  const [overview, setOverview] = useState(null);
  const [watchlist, setWatchlist] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [spy, setSpy] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [assetClass, setAssetClass] = useState("stocks");
  const [addTicker, setAddTicker] = useState("");
  const nav = useNavigate();

  const loadWatchlist = () => api.get("/watchlist").then(r => setWatchlist(r.data)).catch(() => {});

  useEffect(() => {
    api.get("/market/overview").then(r => setOverview(r.data)).catch(() => {});
    loadWatchlist();
    api.get("/market/history/^GSPC?period=1mo").then(r => setSpy(r.data)).catch(() => {});
  }, []);

  const generateBrief = async () => {
    setBriefLoading(true);
    try {
      const { data } = await api.get("/market/brief");
      setBrief(data.brief);
    } catch { toast.error("Failed to generate brief"); }
    finally { setBriefLoading(false); }
  };

  const addStock = async () => {
    if (!addTicker.trim()) return;
    try {
      await api.post("/watchlist/add", { asset_class: assetClass, ticker: addTicker.trim().toUpperCase() });
      toast.success(`${addTicker.toUpperCase()} added to ${assetClass}`);
      setAddOpen(false); setAddTicker(""); loadWatchlist();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add");
    }
  };

  return (
    <div className="p-6 space-y-4" data-testid="command-center">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Command Center</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Real-time market intelligence · updated {new Date().toLocaleTimeString()}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-line" data-testid="cc-add-stock-btn">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Ticker
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-panel border-line">
              <DialogHeader><DialogTitle>Add Ticker to Watchlist</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[["stocks","Stocks"],["crypto","Crypto"],["etfs","ETFs"]].map(([k,l]) => (
                    <button key={k} onClick={() => setAssetClass(k)} data-testid={`cc-asset-${k}`}
                      className={`px-3 py-2 rounded border text-xs uppercase tracking-widest font-mono ${assetClass === k ? "border-terminal text-terminal" : "border-line text-muted-foreground hover:text-foreground"}`}>{l}</button>
                  ))}
                </div>
                <Input placeholder={assetClass === "crypto" ? "BTC-USD" : "AAPL"} value={addTicker} onChange={(e) => setAddTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="cc-add-input" onKeyDown={(e) => { if (e.key === "Enter") addStock(); }} />
                <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={addStock} data-testid="cc-add-submit">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={generateBrief} data-testid="generate-brief-btn">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Generate AI Brief
          </Button>
        </div>
      </div>

      {/* Indices strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(overview?.indices || Array(5).fill(null)).map((i, idx) => (
          <div key={idx} className="border border-line bg-panel rounded-md p-3">
            <div className="overline mb-1">{i?.label || "—"}</div>
            <div className="font-mono text-lg tracking-tight">{fmt(i?.price)}</div>
            <div className={`font-mono text-xs ${pctColor(i?.change_pct)}`}>
              {i?.change_pct > 0 ? "▲" : i?.change_pct < 0 ? "▼" : "·"} {fmt(i?.change_pct)}%
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* SPY chart */}
        <Widget title="S&P 500 · 1M" className="col-span-8">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spy}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#22262E" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#22262E" }} domain={["dataMin", "dataMax"]} />
                <Tooltip contentStyle={{ background: "#121418", border: "1px solid #22262E", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                <Line type="monotone" dataKey="close" stroke="#F97316" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Widget>

        {/* Sectors */}
        <Widget title="Sector Heatmap" className="col-span-4">
          <div className="space-y-1.5">
            {(overview?.sectors || []).slice(0, 8).map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className="w-24 text-muted-foreground">{s.label}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden relative">
                  <div className={`absolute top-0 h-full ${s.change_pct > 0 ? "bg-positive" : "bg-negative"}`}
                    style={{ width: `${Math.min(100, Math.abs(s.change_pct || 0) * 15)}%`, left: s.change_pct > 0 ? "50%" : `${50 - Math.min(50, Math.abs(s.change_pct || 0) * 15)}%` }} />
                </div>
                <span className={`font-mono w-14 text-right ${pctColor(s.change_pct)}`}>{fmt(s.change_pct)}%</span>
              </div>
            ))}
          </div>
        </Widget>

        {/* Watchlist */}
        <Widget title="Watchlist Intelligence" className="col-span-7"
          right={
            <button onClick={() => setAddOpen(true)} className="text-[10px] font-mono text-muted-foreground hover:text-terminal flex items-center gap-1" data-testid="cc-wl-add-btn">
              <Plus className="w-3 h-3" /> Add
            </button>
          }>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-line">
                <th className="text-left py-1.5 font-normal overline">Ticker</th>
                <th className="text-right font-normal overline">Price</th>
                <th className="text-right font-normal overline">Change</th>
                <th className="text-right font-normal overline">Vol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(watchlist?.quotes || []).map((q) => (
                <tr key={q.ticker} onClick={() => nav(`/company/${q.ticker}`)} data-testid={`wl-row-${q.ticker}`}
                  className="border-b border-line hover:bg-surface cursor-pointer transition-colors duration-150">
                  <td className="py-2 font-mono">{q.ticker}</td>
                  <td className="text-right font-mono">{fmt(q.price)}</td>
                  <td className={`text-right font-mono ${pctColor(q.change_pct)}`}>{fmt(q.change_pct)}%</td>
                  <td className="text-right font-mono text-muted-foreground">{q.volume ? (q.volume/1e6).toFixed(1)+"M" : "—"}</td>
                  <td className="text-right"><ArrowUpRight className="w-3 h-3 text-muted-foreground inline" /></td>
                </tr>
              ))}
              {(watchlist?.quotes || []).length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No tickers. Click Add.</td></tr>
              )}
            </tbody>
          </table>
        </Widget>

        {/* AI Brief */}
        <div className="col-span-5">
          {(brief || briefLoading) ? (
            <AIPanel result={brief} loading={briefLoading} title="AI Market Brief" />
          ) : (
            <div className="border border-line bg-panel rounded-md p-6 text-center">
              <Activity className="w-8 h-8 text-terminal mx-auto mb-3" />
              <div className="text-sm mb-1">No brief generated yet</div>
              <div className="text-xs text-muted-foreground mb-4">Click Generate AI Brief to synthesize today&apos;s market context via GPT-5.4.</div>
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={generateBrief} data-testid="cc-brief-cta">Generate Brief</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
