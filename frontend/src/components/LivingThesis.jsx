import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Zap, ShieldCheck, ShieldAlert, ShieldX, GitBranch, Trash2 } from "lucide-react";

const STATUS_META = {
  intact: { icon: ShieldCheck, color: "text-positive border-positive", label: "INTACT" },
  at_risk: { icon: ShieldAlert, color: "text-warning border-warning", label: "AT RISK" },
  broken: { icon: ShieldX, color: "text-negative border-negative", label: "BROKEN" },
};

export default function LivingThesis({ ticker }) {
  const [theses, setTheses] = useState([]);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [diff, setDiff] = useState(null);
  const [open, setOpen] = useState(false);
  // form
  const [stance, setStance] = useState("bull");
  const [headline, setHeadline] = useState("");
  const [narrative, setNarrative] = useState("");
  const [assumptions, setAssumptions] = useState([{ text: "", kind: "business" }]);
  const [catalysts, setCatalysts] = useState([""]);
  const [risks, setRisks] = useState([""]);
  const [confidence, setConfidence] = useState(70);
  const [priceTarget, setPriceTarget] = useState("");
  const [horizon, setHorizon] = useState(12);

  const load = () => api.get(`/thesis/living?ticker=${ticker}`).then(r => {
    setTheses(r.data);
    if (r.data.length && !active) setActive(r.data[0]);
  });
  useEffect(() => { load(); }, [ticker]);
  useEffect(() => {
    if (active) {
      api.get(`/thesis/living/${active.thesis_id}/history`).then(r => setHistory(r.data));
      api.get(`/thesis/living/${active.thesis_id}/diff`).then(r => setDiff(r.data)).catch(() => setDiff(null));
    }
  }, [active?.thesis_id]);

  const resetForm = (parent = null) => {
    setStance(parent?.stance || "bull"); setHeadline(parent?.headline || ""); setNarrative(parent?.narrative || "");
    setAssumptions(parent?.assumptions?.map(a => ({ text: a.text, kind: a.kind })) || [{ text: "", kind: "business" }]);
    setCatalysts(parent?.catalysts?.length ? parent.catalysts : [""]);
    setRisks(parent?.risks?.length ? parent.risks : [""]);
    setConfidence(parent?.confidence || 70);
    setPriceTarget(parent?.price_target || "");
    setHorizon(parent?.time_horizon_months || 12);
  };

  const submit = async (parent_id = null) => {
    if (!headline || !narrative) return toast.error("Headline and narrative required");
    const body = {
      ticker, stance, headline, narrative,
      assumptions: assumptions.filter(a => a.text).map(a => ({ text: a.text, kind: a.kind })),
      catalysts: catalysts.filter(Boolean),
      risks: risks.filter(Boolean),
      confidence: parseInt(confidence),
      price_target: priceTarget ? parseFloat(priceTarget) : null,
      time_horizon_months: parseInt(horizon),
      parent_id,
    };
    const { data } = await api.post("/thesis/living", body);
    setOpen(false); toast.success(parent_id ? "New version saved" : "Thesis created");
    setActive(data);
    load();
  };

  const runCheck = async () => {
    if (!active) return;
    setCheckLoading(true);
    try {
      const { data } = await api.post(`/thesis/living/${active.thesis_id}/check`);
      setActive({ ...active, assumptions: data.assumptions });
      toast.success("Assumption check complete");
    } finally { setCheckLoading(false); }
  };

  const updateAssumptionField = (i, k, v) => {
    const c = [...assumptions]; c[i] = { ...c[i], [k]: v }; setAssumptions(c);
  };

  return (
    <div className="space-y-4" data-testid="living-thesis">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="overline">Living Theses ({theses.length})</div>
          {theses.map((t) => (
            <button key={t.thesis_id} onClick={() => setActive(t)}
              className={`text-xs px-2 py-1 rounded border font-mono ${active?.thesis_id === t.thesis_id ? "border-terminal text-terminal" : "border-line text-muted-foreground hover:text-foreground"}`}>
              {t.stance.toUpperCase()} v{t.version}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {active && (
            <Button size="sm" variant="outline" className="border-line" onClick={() => { resetForm(active); setOpen(true); }} data-testid="new-version-btn">
              <GitBranch className="w-3.5 h-3.5 mr-1" /> New Version
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => resetForm(null)} data-testid="new-thesis-btn">
                <Plus className="w-3.5 h-3.5 mr-1" /> New Thesis
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-panel border-line max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Living Thesis · {ticker}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {["bull","base","bear"].map(s => (
                    <button key={s} onClick={() => setStance(s)}
                      className={`px-3 py-2 rounded border text-xs uppercase tracking-widest font-mono ${stance === s ? (s === "bull" ? "border-positive text-positive" : s === "bear" ? "border-negative text-negative" : "border-terminal text-terminal") : "border-line text-muted-foreground"}`}>{s}</button>
                  ))}
                </div>
                <Input placeholder="Headline (one line)" value={headline} onChange={(e) => setHeadline(e.target.value)} className="bg-base border-line" data-testid="thesis-headline" />
                <textarea placeholder="Narrative (2-4 paragraphs)" value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} className="w-full bg-base border border-line rounded-md p-2 text-sm resize-none" data-testid="thesis-narrative" />

                <div>
                  <div className="overline mb-2">Assumptions</div>
                  {assumptions.map((a, i) => (
                    <div key={i} className="flex gap-2 mb-1">
                      <select value={a.kind} onChange={(e) => updateAssumptionField(i, "kind", e.target.value)} className="bg-base border border-line rounded px-2 text-xs">
                        {["business","competitive","financial","valuation","macro"].map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <Input placeholder="Assumption" value={a.text} onChange={(e) => updateAssumptionField(i, "text", e.target.value)} className="bg-base border-line flex-1" data-testid={`ass-input-${i}`} />
                      <button onClick={() => setAssumptions(assumptions.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setAssumptions([...assumptions, { text: "", kind: "business" }])} className="h-7 text-xs" data-testid="add-assumption-btn"><Plus className="w-3 h-3 mr-1" />Add assumption</Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="overline mb-2">Catalysts</div>
                    {catalysts.map((c, i) => (
                      <div key={i} className="flex gap-1 mb-1">
                        <Input placeholder="Catalyst" value={c} onChange={(e) => { const x = [...catalysts]; x[i] = e.target.value; setCatalysts(x); }} className="bg-base border-line" />
                        <button onClick={() => setCatalysts(catalysts.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setCatalysts([...catalysts, ""])} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add</Button>
                  </div>
                  <div>
                    <div className="overline mb-2">Risks</div>
                    {risks.map((r, i) => (
                      <div key={i} className="flex gap-1 mb-1">
                        <Input placeholder="Risk" value={r} onChange={(e) => { const x = [...risks]; x[i] = e.target.value; setRisks(x); }} className="bg-base border-line" />
                        <button onClick={() => setRisks(risks.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setRisks([...risks, ""])} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add</Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div><div className="overline mb-1">Confidence</div><Input type="number" value={confidence} onChange={(e) => setConfidence(e.target.value)} className="bg-base border-line font-mono" /></div>
                  <div><div className="overline mb-1">Price Target</div><Input type="number" value={priceTarget} onChange={(e) => setPriceTarget(e.target.value)} className="bg-base border-line font-mono" /></div>
                  <div><div className="overline mb-1">Horizon (mo)</div><Input type="number" value={horizon} onChange={(e) => setHorizon(e.target.value)} className="bg-base border-line font-mono" /></div>
                </div>

                <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={() => submit(active?.thesis_id && open ? null : null)} data-testid="save-living-thesis-btn">
                  Save Thesis
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!active && <div className="border border-dashed border-line bg-panel/50 rounded-md p-8 text-center text-xs text-muted-foreground">No thesis yet. Create your first living thesis with assumptions, catalysts, and risks.</div>}

      {active && (
        <div className="space-y-4">
          <div className="border border-line bg-panel rounded-md">
            <div className="p-4 border-b border-line">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase tracking-widest ${active.stance === "bull" ? "border-positive text-positive" : active.stance === "bear" ? "border-negative text-negative" : "border-terminal text-terminal"}`}>{active.stance}</span>
                <span className="overline">v{active.version}</span>
                <span className="text-[10px] font-mono text-muted-foreground ml-2">{new Date(active.created_at).toLocaleString()}</span>
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-xs font-mono">conf <span className="text-terminal">{active.confidence}%</span></div>
                  {active.price_target != null && <div className="text-xs font-mono">PT ${active.price_target}</div>}
                  <div className="text-xs font-mono">{active.time_horizon_months}mo</div>
                </div>
              </div>
              <h3 className="text-xl font-light tracking-tight mb-2">{active.headline}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{active.narrative}</p>
            </div>

            <div className="p-4 border-b border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="overline">Assumption Monitor</div>
                <Button size="sm" variant="outline" className="border-line h-7 text-xs" onClick={runCheck} disabled={checkLoading} data-testid="run-assumption-check-btn">
                  <Zap className="w-3 h-3 mr-1" /> {checkLoading ? "Checking…" : "Run AI Check"}
                </Button>
              </div>
              <div className="space-y-2">
                {(active.assumptions || []).map((a) => {
                  const M = STATUS_META[a.status] || STATUS_META.intact;
                  const Ic = M.icon;
                  return (
                    <div key={a.assumption_id} className="border border-line rounded p-3 bg-base">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded border ${M.color} bg-panel`}><Ic className="w-3.5 h-3.5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="overline">{a.kind}</span>
                            <span className={`text-[10px] font-mono uppercase tracking-widest ${M.color.split(" ")[0]}`}>{M.label}</span>
                            {a.last_checked && <span className="text-[10px] text-muted-foreground font-mono ml-auto">checked {new Date(a.last_checked).toLocaleDateString()}</span>}
                          </div>
                          <div className="text-sm">{a.text}</div>
                          {a.reasoning && <div className="text-xs text-muted-foreground mt-1 font-mono">› {a.reasoning}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(active.assumptions || []).length === 0 && <div className="text-xs text-muted-foreground">No assumptions.</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="p-4">
                <div className="overline mb-2">Catalysts</div>
                <ul className="space-y-1 text-sm">{(active.catalysts || []).map((c, i) => <li key={i} className="flex gap-2"><span className="text-positive">↑</span>{c}</li>)}</ul>
                {(active.catalysts || []).length === 0 && <div className="text-xs text-muted-foreground">None</div>}
              </div>
              <div className="p-4">
                <div className="overline mb-2">Risks</div>
                <ul className="space-y-1 text-sm">{(active.risks || []).map((r, i) => <li key={i} className="flex gap-2"><span className="text-negative">↓</span>{r}</li>)}</ul>
                {(active.risks || []).length === 0 && <div className="text-xs text-muted-foreground">None</div>}
              </div>
            </div>
          </div>

          {diff?.changes?.length > 0 && (
            <div className="border border-line bg-panel rounded-md p-4">
              <div className="overline mb-3">What Changed · v{diff.prev_version} → v{diff.curr_version}</div>
              <div className="space-y-1 text-xs font-mono">
                {diff.changes.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={c.type === "added" ? "text-positive" : c.type === "removed" ? "text-negative" : "text-warning"}>
                      {c.type === "added" ? "+" : c.type === "removed" ? "−" : "~"}
                    </span>
                    <span className="text-muted-foreground">[{c.field}]</span>
                    {c.type === "changed" ? <span>{JSON.stringify(c.from)} → {JSON.stringify(c.to)}</span> : <span>{c.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 1 && (
            <div className="border border-line bg-panel rounded-md p-4">
              <div className="overline mb-3">Version History</div>
              <div className="space-y-1 text-xs font-mono">
                {history.map((h) => (
                  <button key={h.thesis_id} onClick={() => setActive(h)}
                    className={`w-full text-left px-2 py-1 rounded hover:bg-surface ${h.thesis_id === active.thesis_id ? "bg-surface" : ""}`}>
                    v{h.version} · {h.stance.toUpperCase()} · conf {h.confidence}% · {new Date(h.created_at).toLocaleDateString()} · {h.headline.slice(0, 50)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
