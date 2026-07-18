import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import LivingThesis from "@/components/LivingThesis";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { Plus, Bot, ExternalLink } from "lucide-react";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");
const compact = (n) => n == null ? "—" : Intl.NumberFormat("en", { notation: "compact" }).format(n);

const AGENTS = [
  { key: "research", label: "Research" },
  { key: "financial", label: "Financial" },
  { key: "news", label: "News" },
  { key: "competitor", label: "Competitor" },
  { key: "risk", label: "Risk" },
  { key: "valuation", label: "Valuation" },
  { key: "macro", label: "Macro" },
  { key: "contradiction", label: "Contradiction" },
  { key: "management", label: "Management" },
  { key: "materiality", label: "Materiality" },
  { key: "earnings_diff", label: "Earnings Diff" },
];

export default function CompanyDetail() {
  const { ticker } = useParams();
  const [profile, setProfile] = useState(null);
  const [quote, setQuote] = useState(null);
  const [hist, setHist] = useState([]);
  const [fin, setFin] = useState(null);
  const [news, setNews] = useState([]);
  const [thesis, setThesis] = useState([]);
  const [agentResults, setAgentResults] = useState({});
  const [agentLoading, setAgentLoading] = useState({});

  useEffect(() => {
    api.get(`/company/${ticker}/profile`).then(r => setProfile(r.data));
    api.get(`/market/quote/${ticker}`).then(r => setQuote(r.data));
    api.get(`/market/history/${ticker}?period=6mo`).then(r => setHist(r.data));
    api.get(`/company/${ticker}/financials`).then(r => setFin(r.data));
    api.get(`/company/${ticker}/news`).then(r => setNews(r.data));
    api.get(`/thesis/legacy/${ticker}`).then(r => setThesis(r.data)).catch(() => {});
  }, [ticker]);

  const runAgent = async (key) => {
    setAgentLoading((s) => ({ ...s, [key]: true }));
    try {
      const { data } = await api.post("/agents/query", {
        agent: key, ticker,
        question: `Provide a ${key} analysis of ${ticker}. Include evidence, sources, and assumptions.`,
      });
      setAgentResults((s) => ({ ...s, [key]: data }));
    } catch { toast.error("Agent failed"); }
    finally { setAgentLoading((s) => ({ ...s, [key]: false })); }
  };

  const addToWatchlist = async () => {
    try { await api.post("/watchlist/add", { ticker }); toast.success(`${ticker} added to watchlist`); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="company-detail">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light tracking-tighter font-mono">{ticker}</h1>
            <span className="text-sm text-muted-foreground">{profile?.name}</span>
            <span className="text-xs px-2 py-0.5 border border-line rounded text-muted-foreground">{profile?.sector}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <span className="text-4xl font-mono tracking-tight">${fmt(quote?.price)}</span>
            <span className={`font-mono text-lg ${pct(quote?.change_pct)}`}>
              {quote?.change_pct > 0 ? "▲" : "▼"} {fmt(quote?.change)} ({fmt(quote?.change_pct)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-line" onClick={addToWatchlist} data-testid="add-watchlist-btn">
            <Plus className="w-3.5 h-3.5 mr-1" /> Watchlist
          </Button>
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => runAgent("research")} data-testid="run-research-btn">
            <Bot className="w-3.5 h-3.5 mr-1" /> Run Research Agent
          </Button>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Market Cap", val: compact(profile?.market_cap) },
          { label: "P/E", val: fmt(profile?.pe) },
          { label: "Fwd P/E", val: fmt(profile?.forward_pe) },
          { label: "Div Yield", val: profile?.dividend_yield ? (profile.dividend_yield * 100).toFixed(2) + "%" : "—" },
          { label: "Beta", val: fmt(profile?.beta) },
          { label: "52W Range", val: `${fmt(profile?.["52w_low"])} – ${fmt(profile?.["52w_high"])}` },
        ].map((m) => (
          <div key={m.label} className="border border-line bg-panel rounded-md p-3">
            <div className="overline mb-1">{m.label}</div>
            <div className="font-mono text-sm">{m.val}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="border border-line bg-panel rounded-md">
        <div className="overline px-4 py-2.5 border-b border-line">Price · 6M</div>
        <div className="h-64 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#22262E" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6B7280", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#22262E" }} domain={["dataMin", "dataMax"]} />
              <Tooltip contentStyle={{ background: "#121418", border: "1px solid #22262E", fontSize: 11 }} />
              <Line type="monotone" dataKey="close" stroke="#F97316" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-transparent border-b border-line rounded-none w-full justify-start p-0 h-auto">
          {["overview","financials","news","agents","thesis"].map(t => (
            <TabsTrigger key={t} value={t} data-testid={`company-tab-${t}`}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-terminal data-[state=active]:bg-transparent text-muted-foreground data-[state=active]:text-foreground uppercase tracking-widest text-[10px] py-2 px-3">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="border border-line bg-panel rounded-md p-5">
            <div className="overline mb-2">Business Summary</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{profile?.summary || "Loading…"}</p>
          </div>
        </TabsContent>
        <TabsContent value="financials" className="mt-4 space-y-4">
          {["income_statement","balance_sheet","cash_flow"].map((k) => {
            const rows = fin?.[k] || [];
            const cols = rows.length ? Object.keys(rows[0]).slice(0, 8) : [];
            return (
              <div key={k} className="border border-line bg-panel rounded-md overflow-hidden">
                <div className="overline px-4 py-2.5 border-b border-line">{k.replace(/_/g, " ")}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-line">
                        {cols.map(c => <th key={c} className="text-right font-normal px-3 py-2 overline">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-line hover:bg-surface">
                          {cols.map((c, j) => (
                            <td key={c} className={`px-3 py-1.5 ${j === 0 ? "" : "text-right"} font-mono`}>
                              {j === 0 ? r[c] : (typeof r[c] === "number" ? compact(r[c]) : (r[c] || "—"))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="news" className="mt-4 space-y-2">
          {news.map((n, i) => (
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block border border-line bg-panel rounded-md p-3 hover:border-line2 transition-colors">
              <div className="text-sm">{n.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span>{n.publisher}</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </a>
          ))}
          {news.length === 0 && <div className="text-xs text-muted-foreground">No news available.</div>}
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {AGENTS.map((a) => (
              <div key={a.key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="overline">{a.label} Agent</div>
                  <Button size="sm" variant="outline" className="border-line h-7 text-xs" onClick={() => runAgent(a.key)} data-testid={`agent-btn-${a.key}`}>Run</Button>
                </div>
                <AIPanel result={agentResults[a.key]} loading={agentLoading[a.key]} title={a.label} />
                {!agentResults[a.key] && !agentLoading[a.key] && (
                  <div className="border border-line border-dashed bg-panel/50 rounded-md p-6 text-center text-xs text-muted-foreground">
                    Run to synthesize {a.label.toLowerCase()} analysis.
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="thesis" className="mt-4">
          <LivingThesis ticker={ticker} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThesisEditor({ ticker, theses, onCreate }) {
  const [stance, setStance] = useState("bull");
  const [text, setText] = useState("");
  const submit = async () => {
    if (!text.trim()) return;
    try {
      const { data } = await api.post("/thesis", { ticker, stance, thesis: text, evidence: [] });
      onCreate(data);
      setText("");
      toast.success("Thesis saved");
    } catch { toast.error("Failed"); }
  };
  return (
    <div className="space-y-4">
      <div className="border border-line bg-panel rounded-md p-4">
        <div className="overline mb-3">New Thesis</div>
        <div className="flex gap-2 mb-3">
          {["bull","base","bear"].map(s => (
            <button key={s} onClick={() => setStance(s)} data-testid={`stance-${s}`}
              className={`px-3 py-1 rounded-md text-xs uppercase tracking-widest border ${stance === s ? (s === "bull" ? "border-positive text-positive" : s === "bear" ? "border-negative text-negative" : "border-terminal text-terminal") : "border-line text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} data-testid="thesis-input"
          className="w-full bg-base border border-line rounded-md p-3 text-sm resize-none font-mono" placeholder="Write your thesis with evidence…" />
        <div className="mt-3 flex justify-end">
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={submit} data-testid="save-thesis-btn">Save Thesis</Button>
        </div>
      </div>
      <div className="space-y-2">
        {theses.map((t) => (
          <div key={t.thesis_id} className="border border-line bg-panel rounded-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${t.stance === "bull" ? "border-positive text-positive" : t.stance === "bear" ? "border-negative text-negative" : "border-terminal text-terminal"}`}>{t.stance.toUpperCase()}</span>
              <span className="text-xs text-muted-foreground font-mono">{new Date(t.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm leading-relaxed">{t.thesis}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
