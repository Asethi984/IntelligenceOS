import { useEffect, useState } from "react";
import api from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Brain, Sparkles } from "lucide-react";
import AIAssist from "@/components/AIAssist";

const ACTION_COLORS = { buy: "text-positive border-positive", sell: "text-negative border-negative", hold: "text-warning border-warning", watch: "text-insight border-insight" };

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState("buy");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [horizon, setHorizon] = useState("12");
  const [conf, setConf] = useState("70");
  const [open, setOpen] = useState(false);
  const [bias, setBias] = useState(null);
  const [biasLoading, setBiasLoading] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmEntry, setPmEntry] = useState(null);
  const [pmOutcome, setPmOutcome] = useState("right");
  const [pmSummary, setPmSummary] = useState("");
  const [pmLessons, setPmLessons] = useState("");

  const load = () => api.get("/journal").then(r => setEntries(r.data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!ticker || !reason || !expected) return toast.error("Ticker, reason, and expected outcome required");
    await api.post("/journal", {
      ticker, action, decision_reason: reason, expected_outcome: expected,
      expected_timeframe_months: parseInt(horizon), confidence: parseInt(conf),
    });
    setOpen(false); setTicker(""); setReason(""); setExpected("");
    toast.success("Decision logged"); load();
  };
  const remove = async (id) => { await api.delete(`/journal/${id}`); load(); };

  const openPm = (e) => { setPmEntry(e); setPmOutcome("right"); setPmSummary(""); setPmLessons(""); setPmOpen(true); };
  const savePm = async () => {
    if (!pmSummary) return toast.error("Summary required");
    await api.post(`/journal/${pmEntry.entry_id}/postmortem`, {
      result_outcome: pmOutcome, result_summary: pmSummary,
      lessons: pmLessons.split("\n").filter(Boolean),
    });
    setPmOpen(false); toast.success("Post-mortem saved"); load();
  };

  const analyze = async () => {
    setBiasLoading(true); setBias(null);
    try { const { data } = await api.get("/journal/analyze"); setBias(data); }
    finally { setBiasLoading(false); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="journal-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Decision Journal</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Every buy/sell captured · learn from your own patterns</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-line" onClick={async () => { await api.post("/demo/seed"); toast.success("Demo data loaded"); load(); }} data-testid="seed-demo-btn">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Load Sample
          </Button>
          <Button size="sm" variant="outline" className="border-line" onClick={analyze} data-testid="analyze-bias-btn">
            <Brain className="w-3.5 h-3.5 mr-1" /> Detect Biases
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" data-testid="add-decision-btn">
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Decision
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-panel border-line max-w-lg">
              <DialogHeader><DialogTitle>Log Investment Decision</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="dj-ticker" />
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger className="bg-base border-line"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="watch">Watch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="overline mb-1">Why? (decision reason)</div>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-base border border-line rounded-md p-2 text-sm font-mono resize-none text-foreground" data-testid="dj-reason" />
                  <div className="mt-2"><AIAssist contextType="journal_reason" text={reason} onApply={setReason} ticker={ticker} /></div>
                </div>
                <div>
                  <div className="overline mb-1">Expected outcome</div>
                  <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} className="w-full bg-base border border-line rounded-md p-2 text-sm font-mono resize-none text-foreground" data-testid="dj-expected" />
                  <div className="mt-2"><AIAssist contextType="journal_expected" text={expected} onApply={setExpected} ticker={ticker} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Horizon (months)" value={horizon} onChange={(e) => setHorizon(e.target.value)} className="bg-base border-line font-mono" />
                  <Input type="number" placeholder="Confidence 0-100" value={conf} onChange={(e) => setConf(e.target.value)} className="bg-base border-line font-mono" />
                </div>
                <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={add} data-testid="submit-decision-btn">Log Decision</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(biasLoading || bias) && <AIPanel result={bias} loading={biasLoading} title="Bias Detection · your patterns" />}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.entry_id} className="border border-line bg-panel rounded-md p-4">
            <div className="flex items-start gap-4">
              <div className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-widest font-mono ${ACTION_COLORS[e.action]}`}>{e.action}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-lg">{e.ticker}</span>
                  <span className="text-xs font-mono text-muted-foreground">@ ${e.price_at_decision?.toFixed(2) || "—"}</span>
                  <span className="text-xs font-mono text-muted-foreground">· conf {e.confidence}%</span>
                  <span className="text-xs font-mono text-muted-foreground">· {e.expected_timeframe_months}mo horizon</span>
                  <span className="text-xs font-mono text-muted-foreground ml-auto">{new Date(e.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-sm mb-1"><span className="overline mr-2">reason</span>{e.decision_reason}</div>
                <div className="text-sm text-muted-foreground"><span className="overline mr-2">expected</span>{e.expected_outcome}</div>
                {e.result_outcome ? (
                  <div className="mt-3 pt-3 border-t border-line text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="overline">outcome</span>
                      <span className={`text-xs font-mono uppercase ${e.result_outcome === "right" ? "text-positive" : e.result_outcome === "wrong" ? "text-negative" : "text-warning"}`}>{e.result_outcome}</span>
                    </div>
                    <div className="text-muted-foreground">{e.result_summary}</div>
                    {e.lessons?.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground list-disc pl-5">{e.lessons.map((l,i) => <li key={i}>{l}</li>)}</ul>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => openPm(e)} className="mt-3 border-line h-7 text-xs" data-testid={`postmortem-${e.ticker}`}>Add Post-Mortem</Button>
                )}
              </div>
              <button onClick={() => remove(e.entry_id)} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-center text-xs text-muted-foreground py-12">No decisions logged yet. Log your first one.</div>}
      </div>

      <Dialog open={pmOpen} onOpenChange={setPmOpen}>
        <DialogContent className="bg-panel border-line max-w-lg">
          <DialogHeader><DialogTitle>Post-Mortem · {pmEntry?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={pmOutcome} onValueChange={setPmOutcome}>
              <SelectTrigger className="bg-base border-line"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right call</SelectItem>
                <SelectItem value="wrong">Wrong call</SelectItem>
                <SelectItem value="partial">Partially right</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <div className="overline mb-1">What actually happened?</div>
              <textarea value={pmSummary} onChange={(e) => setPmSummary(e.target.value)} rows={3} className="w-full bg-base border border-line rounded-md p-2 text-sm font-mono resize-none" />
            </div>
            <div>
              <div className="overline mb-1">Lessons (one per line)</div>
              <textarea value={pmLessons} onChange={(e) => setPmLessons(e.target.value)} rows={3} className="w-full bg-base border border-line rounded-md p-2 text-sm font-mono resize-none" />
            </div>
            <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={savePm} data-testid="save-pm-btn">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
