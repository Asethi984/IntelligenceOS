import { useState } from "react";
import api from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import { Button } from "@/components/ui/button";
import { Network, Activity } from "lucide-react";

const MACRO_LABELS = {
  interest_rates: "Interest Rates", oil: "Oil", china: "China", ai: "AI",
  semiconductors: "Semiconductors", inflation: "Inflation", housing: "Housing",
  defense: "Defense", consumer: "Consumer",
};

export default function PortfolioIntelligence() {
  const [connections, setConnections] = useState(null);
  const [macro, setMacro] = useState(null);
  const [cLoading, setCLoading] = useState(false);
  const [mLoading, setMLoading] = useState(false);

  const runConnections = async () => {
    setCLoading(true); setConnections(null);
    try { const { data } = await api.get("/portfolio/connections"); setConnections(data); }
    finally { setCLoading(false); }
  };
  const runMacro = async () => {
    setMLoading(true); setMacro(null);
    try { const { data } = await api.get("/portfolio/macro"); setMacro(data); }
    finally { setMLoading(false); }
  };

  return (
    <div className="grid grid-cols-2 gap-4" data-testid="portfolio-intelligence">
      <div className="border border-line bg-panel rounded-md">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-2"><Network className="w-3.5 h-3.5 text-insight" /><span className="overline">Hidden Connections</span></div>
          <Button size="sm" variant="outline" className="border-line h-7 text-xs" onClick={runConnections} data-testid="run-connections-btn">Detect</Button>
        </div>
        <div className="p-4">
          {(cLoading || connections) ? <AIPanel result={connections} loading={cLoading} title="Thesis Clusters" /> :
            <div className="text-xs text-muted-foreground text-center py-8">AI identifies thesis clusters beyond sector labels. Click Detect to run.</div>}
        </div>
      </div>

      <div className="border border-line bg-panel rounded-md">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
          <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-terminal" /><span className="overline">Macro Exposure Map</span></div>
          <Button size="sm" variant="outline" className="border-line h-7 text-xs" onClick={runMacro} data-testid="run-macro-btn">Map</Button>
        </div>
        <div className="p-4">
          {mLoading && <div className="text-xs text-muted-foreground font-mono">› Mapping factor exposures…</div>}
          {!mLoading && macro?.exposures?.length > 0 ? (
            <div className="space-y-2">
              {macro.exposures.map((e) => (
                <div key={e.factor} className="flex items-center gap-3 text-xs">
                  <span className="w-32 text-muted-foreground">{MACRO_LABELS[e.factor] || e.factor}</span>
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className={`h-full ${e.score >= 60 ? "bg-terminal" : e.score >= 30 ? "bg-warning" : "bg-insight"}`} style={{ width: `${e.score}%` }} />
                  </div>
                  <span className="font-mono w-8 text-right">{e.score}</span>
                </div>
              ))}
              {macro.summary && <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-line">{macro.summary}</div>}
            </div>
          ) : (!mLoading && <div className="text-xs text-muted-foreground text-center py-8">Quantify exposure to rates, oil, AI, semis, China, and more.</div>)}
        </div>
      </div>
    </div>
  );
}
