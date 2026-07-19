import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Coins, TrendingUp, Landmark, Lock } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

const CLASS_META = {
  stocks: { icon: TrendingUp, label: "Stocks", color: "text-terminal" },
  crypto: { icon: Coins, label: "Crypto", color: "text-warning" },
  etfs:   { icon: Landmark, label: "ETFs", color: "text-insight" },
};

function Sparkline({ ticker }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    api.get(`/market/history/${ticker}?period=1mo`).then(r => setData(r.data)).catch(() => {});
  }, [ticker]);
  if (!data.length) return <div className="w-24 h-8" />;
  const last = data[data.length - 1]?.close;
  const first = data[0]?.close;
  const color = last >= first ? "#22C55E" : "#EF4444";
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}><Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} dot={false} /></LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Board() {
  const [lists, setLists] = useState([]);
  const [plan, setPlan] = useState("Free");
  const [cap, setCap] = useState(5);
  const [tab, setTab] = useState("stocks");
  const [addTicker, setAddTicker] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const load = () => api.get("/watchlist/lists").then(r => { setLists(r.data.lists); setPlan(r.data.plan); setCap(r.data.additional_cap_free); });
  useEffect(() => { load(); }, []);

  const current = lists.find(l => l.asset_class === tab);

  const add = async () => {
    if (!addTicker) return;
    try {
      await api.post("/watchlist/add", { asset_class: tab, ticker: addTicker.toUpperCase() });
      setAddTicker(""); setOpen(false); toast.success("Added"); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const remove = async (t) => {
    // only allow removing user-added tickers
    if (current?.default_tickers?.includes(t)) return toast.error("Default tickers cannot be removed on Free plan");
    await api.post("/watchlist/remove", { asset_class: tab, ticker: t });
    toast.success("Removed"); load();
  };

  return (
    <div className="p-6 space-y-4" data-testid="board-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Board</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">TradingView-style multi-asset watchlist · Stocks · Crypto · ETFs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line">
        {Object.entries(CLASS_META).map(([key, m]) => {
          const Ic = m.icon;
          const lst = lists.find(l => l.asset_class === key);
          return (
            <button key={key} onClick={() => setTab(key)} data-testid={`board-tab-${key}`}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm transition-colors ${tab === key ? "border-terminal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Ic className={`w-4 h-4 ${m.color}`} />
              {m.label}
              <span className="text-[10px] font-mono text-muted-foreground ml-1">({(lst?.tickers || []).length})</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          {plan === "Free" && current && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Free · {current.user_slots_used}/{cap} added · <button onClick={() => nav("/settings")} className="text-terminal hover:underline">upgrade</button></span>
            </div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90 h-8" data-testid="board-add-btn"
                disabled={plan === "Free" && current && current.user_slots_used >= cap}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add {CLASS_META[tab].label}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-panel border-line">
              <DialogHeader><DialogTitle>Add {CLASS_META[tab].label} Ticker</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder={tab === "crypto" ? "BTC-USD, ETH-USD, SOL-USD…" : "AAPL, MSFT, SPY…"}
                  value={addTicker} onChange={(e) => setAddTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="board-add-input" />
                <div className="text-[11px] text-muted-foreground font-mono">
                  {tab === "crypto" && "Use -USD suffix (e.g., BTC-USD)"}
                  {tab === "etfs" && "Standard ETF tickers (SPY, QQQ, VTI, VOO, ARKK…)"}
                </div>
                <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={add} data-testid="board-submit-add">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-line">
              {["Symbol","Price","Change","% Change","Sparkline","Vol",""].map(h => (
                <th key={h} className="text-left font-normal overline px-3 py-2 first:pl-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(current?.quotes || []).map((q, i) => {
              const t = current.tickers[i];
              const isDefault = current.default_tickers.includes(t);
              return (
                <tr key={t} className="border-b border-line hover:bg-surface cursor-pointer group" onClick={() => nav(`/company/${t}`)} data-testid={`board-row-${t}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{t}</span>
                      {isDefault && <span className="text-[9px] font-mono text-muted-foreground border border-line px-1 py-0.5 rounded">DEFAULT</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono">${fmt(q.price)}</td>
                  <td className={`px-3 py-2.5 font-mono ${pct(q.change)}`}>{q.change > 0 ? "+" : ""}{fmt(q.change)}</td>
                  <td className={`px-3 py-2.5 font-mono ${pct(q.change_pct)}`}>
                    {q.change_pct > 0 ? "▲" : q.change_pct < 0 ? "▼" : "·"} {fmt(q.change_pct)}%
                  </td>
                  <td className="px-3 py-2.5"><Sparkline ticker={t} /></td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{q.volume ? (q.volume/1e6).toFixed(2)+"M" : "—"}</td>
                  <td className="px-3 py-2.5 text-right w-10">
                    {!isDefault && (
                      <button onClick={(e) => { e.stopPropagation(); remove(t); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-negative" data-testid={`board-remove-${t}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!current || (current.quotes || []).length === 0) && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No tickers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
