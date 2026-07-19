import { useState } from "react";
import api from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot } from "lucide-react";

const AGENTS = [
  { key: "research", label: "Research Agent" },
  { key: "financial", label: "Financial Agent" },
  { key: "news", label: "News Agent" },
  { key: "competitor", label: "Competitor Agent" },
  { key: "risk", label: "Risk Agent" },
  { key: "valuation", label: "Valuation Agent" },
  { key: "macro", label: "Macro Agent" },
  { key: "contradiction", label: "Contradiction Detector" },
  { key: "management", label: "Management Quality" },
  { key: "materiality", label: "News Materiality" },
  { key: "earnings_diff", label: "Earnings Diff" },
  { key: "bias", label: "Bias Detector" },
];

export default function AIAgents() {
  const [agent, setAgent] = useState("research");
  const [ticker, setTicker] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true); setResult(null);
    try {
      const { data } = await api.post("/agents/query", { agent, ticker: ticker || null, question: q });
      setResult(data);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="agents-page">
      <div>
        <h1 className="text-3xl font-light tracking-tighter">AI Agents</h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">Seven specialized analysts · evidence-anchored · GPT-5.2</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 space-y-3">
          {AGENTS.map(a => (
            <button key={a.key} onClick={() => setAgent(a.key)} data-testid={`agent-select-${a.key}`}
              className={`w-full border rounded-md px-4 py-3 text-left transition-colors ${agent === a.key ? "border-terminal bg-panel" : "border-line bg-panel hover:bg-surface"}`}>
              <div className="flex items-center gap-3">
                <Bot className={`w-4 h-4 ${agent === a.key ? "text-terminal" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm">{a.label}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{a.key}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="col-span-8 space-y-4">
          <div className="border border-line bg-panel rounded-md p-4">
            <div className="overline mb-3">Query</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Input placeholder="Ticker (optional)" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="agent-ticker" />
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger className="col-span-2 bg-base border-line"><SelectValue /></SelectTrigger>
                <SelectContent>{AGENTS.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={4} placeholder="Ask a question… e.g., 'Assess NVDA's competitive moat vs AMD.'"
              className="w-full bg-base border border-line rounded-md p-3 text-sm resize-none font-mono" data-testid="agent-question" />
            <div className="mt-3 flex justify-end">
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={run} disabled={busy} data-testid="run-agent-btn">
                {busy ? "Running…" : "Run Agent"}
              </Button>
            </div>
          </div>
          <AIPanel result={result} loading={busy} title={AGENTS.find(a => a.key === agent)?.label} />
        </div>
      </div>
    </div>
  );
}
