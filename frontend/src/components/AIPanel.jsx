import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export default function AIPanel({ result, title = "AI Analysis", loading = false }) {
  if (loading) {
    return (
      <div className="border border-line bg-panel rounded-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-terminal" />
          <span className="overline">{title}</span>
        </div>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>› Fetching sources…</p>
          <p>› Reasoning across evidence…</p>
          <p>› Calculating confidence…</p>
        </div>
      </div>
    );
  }
  if (!result) return null;
  const conf = result.confidence || 0;
  const confColor = conf >= 70 ? "text-positive" : conf >= 40 ? "text-warning" : "text-negative";
  return (
    <div className="border border-line bg-panel rounded-md" data-testid="ai-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-terminal" />
          <span className="overline">{title}</span>
        </div>
        <Badge variant="outline" className={`font-mono text-[10px] ${confColor} border-line`}>
          CONFIDENCE {conf}%
        </Badge>
      </div>
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b border-line rounded-none h-auto p-0">
          {["summary","evidence","sources","confidence","assumptions"].map((t) => (
            <TabsTrigger key={t} value={t}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-terminal data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground uppercase tracking-widest text-[10px] font-medium py-2 px-3"
              data-testid={`ai-tab-${t}`}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="summary" className="p-4 text-sm leading-relaxed">
          {result.summary || <span className="text-muted-foreground">No summary</span>}
        </TabsContent>
        <TabsContent value="evidence" className="p-4 space-y-2 text-sm">
          {(result.evidence || []).length ? result.evidence.map((e, i) => (
            <div key={i} className="flex gap-2"><span className="text-terminal font-mono text-xs">[{i+1}]</span><span>{e}</span></div>
          )) : <span className="text-muted-foreground text-xs">No evidence</span>}
        </TabsContent>
        <TabsContent value="sources" className="p-4 space-y-1 text-xs font-mono">
          {(result.sources || []).length ? result.sources.map((s, i) => (
            <div key={i} className="text-insight">› {s}</div>
          )) : <span className="text-muted-foreground">No sources</span>}
        </TabsContent>
        <TabsContent value="confidence" className="p-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
              <div className={`h-full ${conf >= 70 ? "bg-positive" : conf >= 40 ? "bg-warning" : "bg-negative"}`} style={{width: `${conf}%`}} />
            </div>
            <span className={`font-mono text-xs ${confColor}`}>{conf}%</span>
          </div>
          <p className="text-muted-foreground text-xs mt-2">Confidence is based on evidence quality, source reliability, and internal reasoning coherence.</p>
        </TabsContent>
        <TabsContent value="assumptions" className="p-4 space-y-1 text-sm">
          {(result.assumptions || []).length ? result.assumptions.map((a, i) => (
            <div key={i} className="text-muted-foreground">· {a}</div>
          )) : <span className="text-muted-foreground text-xs">No assumptions listed</span>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
