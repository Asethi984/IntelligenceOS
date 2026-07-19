import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Activity, TrendingUp, Briefcase } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import PortfolioIntelligence from "@/components/PortfolioIntelligence";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");
const COLORS = ["#F97316","#22C55E","#818CF8","#F59E0B","#EF4444","#06B6D4","#EC4899","#84CC16"];

export default function Portfolio() {
  const [port, setPort] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState({ key: "value", desc: true });
  const nav = useNavigate();

  const load = () => api.get("/portfolio").then(r => setPort(r.data));
  useEffect(() => { load(); }, []);
  const setSortKey = (k) => setSort({ key: k, desc: sort.key === k ? !sort.desc : true });

  const add = async () => {
    if (!ticker || !shares || !cost) return toast.error("All fields required");
    await api.post("/portfolio/add", { ticker: ticker.toUpperCase(), shares: parseFloat(shares), cost_basis: parseFloat(cost) });
    setOpen(false); setTicker(""); setShares(""); setCost("");
    toast.success("Holding added"); load();
  };
  const remove = async (id) => { await api.delete(`/portfolio/${id}`); load(); };

  const genBrief = async () => {
    setBriefLoading(true);
    try { const { data } = await api.get("/portfolio/brief"); setBrief(data.brief); }
    finally { setBriefLoading(false); }
  };

  const pieData = (port?.holdings || []).map(h => ({ name: h.ticker, value: h.value }));

  return (
    <div className="p-6 space-y-4" data-testid="portfolio-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Portfolio</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Intelligence · Health · Signals</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-line" onClick={genBrief} data-testid="portfolio-brief-btn">
            <Activity className="w-3.5 h-3.5 mr-1" /> Daily Brief
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" data-testid="add-holding-btn">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Holding
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-panel border-line">
              <DialogHeader><DialogTitle>Add Holding</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Ticker (e.g., AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value)} className="bg-base border-line font-mono" data-testid="holding-ticker" />
                <Input type="number" placeholder="Shares" value={shares} onChange={(e) => setShares(e.target.value)} className="bg-base border-line font-mono" data-testid="holding-shares" />
                <Input type="number" placeholder="Cost basis / share" value={cost} onChange={(e) => setCost(e.target.value)} className="bg-base border-line font-mono" data-testid="holding-cost" />
                <Button onClick={add} className="w-full bg-terminal text-black hover:bg-terminal/90" data-testid="submit-holding-btn">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Value", val: "$" + fmt(port?.total_value, 0) },
          { label: "Cost Basis", val: "$" + fmt(port?.total_cost, 0) },
          { label: "Total Gain", val: (port?.total_gain >= 0 ? "+" : "") + "$" + fmt(port?.total_gain, 0), color: pct(port?.total_gain) },
          { label: "Health Score", val: (port?.health_score || 0) + "/100", color: (port?.health_score || 0) >= 70 ? "text-positive" : "text-warning" },
        ].map(k => (
          <div key={k.label} className="border border-line bg-panel rounded-md p-4">
            <div className="overline mb-1">{k.label}</div>
            <div className={`font-mono text-xl tracking-tight ${k.color || ""}`}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 border border-line bg-panel rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <div className="overline">Holdings ({(port?.holdings || []).length})</div>
            <div className="text-[10px] font-mono text-muted-foreground">Click column to sort · Click row to open company</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-line">
                {[
                  {k:"ticker",l:"Ticker"},{k:"shares",l:"Shares"},{k:"cost_basis",l:"Cost"},
                  {k:"price",l:"Price"},{k:"value",l:"Value"},{k:"gain_pct",l:"Gain"},
                  {k:"allocation",l:"Alloc"},{k:"change_pct",l:"Today"}
                ].map(c => (
                  <th key={c.k} onClick={() => setSortKey(c.k)}
                    className="text-right font-normal overline px-3 py-2 cursor-pointer hover:text-terminal">
                    {c.l}{sort.key === c.k && <span className="ml-1">{sort.desc ? "↓" : "↑"}</span>}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...(port?.holdings || [])].sort((a,b) => {
                const va = a[sort.key] ?? -Infinity, vb = b[sort.key] ?? -Infinity;
                if (typeof va === "string") return sort.desc ? vb.localeCompare(va) : va.localeCompare(vb);
                return sort.desc ? vb - va : va - vb;
              }).map(h => (
                <tr key={h.holding_id} className="border-b border-line hover:bg-surface cursor-pointer" onClick={() => nav(`/company/${h.ticker}`)}>
                  <td className="px-3 py-2 font-mono text-left">{h.ticker}</td>
                  <td className="px-3 py-2 font-mono text-right">{fmt(h.shares, 0)}</td>
                  <td className="px-3 py-2 font-mono text-right text-muted-foreground">${fmt(h.cost_basis)}</td>
                  <td className="px-3 py-2 font-mono text-right">${fmt(h.price)}</td>
                  <td className="px-3 py-2 font-mono text-right">${fmt(h.value, 0)}</td>
                  <td className={`px-3 py-2 font-mono text-right ${pct(h.gain)}`}>{fmt(h.gain_pct)}%</td>
                  <td className="px-3 py-2 font-mono text-right text-muted-foreground">{fmt(h.allocation)}%</td>
                  <td className={`px-3 py-2 font-mono text-right ${pct(h.change_pct)}`}>{fmt(h.change_pct)}%</td>
                  <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); remove(h.holding_id); }} className="text-muted-foreground hover:text-negative" data-testid={`remove-holding-${h.ticker}`}><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}
              {(port?.holdings || []).length === 0 && (
                <tr><td colSpan={9} className="py-10">
                  <div className="text-center">
                    <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <div className="text-sm mb-1">No holdings yet</div>
                    <div className="text-xs text-muted-foreground mb-4">Add your first position to unlock health score, AI daily brief, hidden connections, and macro exposure.</div>
                    <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add your first holding</Button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="col-span-4 border border-line bg-panel rounded-md p-4">
          <div className="overline mb-3">Allocation</div>
          {pieData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#121418" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-xs text-muted-foreground text-center py-10">No data</div>}
          <div className="mt-3 space-y-1 text-xs">
            {pieData.slice(0,5).map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 font-mono">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span>{d.name}</span>
                <span className="ml-auto text-muted-foreground">${fmt(d.value, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12">
          <AIPanel result={brief} loading={briefLoading} title="AI Portfolio Brief" />
        </div>

        <div className="col-span-12">
          <PortfolioIntelligence />
        </div>
      </div>
    </div>
  );
}
