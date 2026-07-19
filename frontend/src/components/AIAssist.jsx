import { useState } from "react";
import api from "@/lib/api";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Universal AI writing assistant.
 * Props:
 *   contextType: "note"|"thesis"|"journal_reason"|"journal_expected"|"catalyst"|"risk"|"assumption"
 *   text:        current text (string)
 *   onApply(newText): callback to replace the text
 *   ticker:      optional ticker for context
 *   size:        "sm" | "xs" (default xs)
 */
export default function AIAssist({ contextType = "note", text = "", onApply, ticker, size = "xs", label }) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const run = async (instruction) => {
    setBusy(true); setSuggestion(null);
    try {
      const { data } = await api.post("/agents/assist", {
        context_type: contextType, current_text: text, ticker, instruction,
      });
      setSuggestion(data.summary);
    } catch {
      toast.error("AI assist failed");
    } finally { setBusy(false); }
  };

  const apply = () => { if (suggestion && onApply) { onApply(suggestion); setSuggestion(null); toast.success("Applied"); } };
  const reject = () => setSuggestion(null);

  const btnSize = size === "sm" ? "h-8 text-xs" : "h-7 text-[11px]";

  return (
    <div className="w-full" data-testid="ai-assist">
      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={() => run("improve")} disabled={busy} className={`${btnSize} px-2 rounded border border-insight/50 text-insight hover:bg-insight/10 font-mono uppercase tracking-widest flex items-center gap-1 disabled:opacity-50`} data-testid="ai-improve-btn">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {label || "AI Assist"}
        </button>
        {text && !busy && (
          <>
            <button onClick={() => run("shorten")} disabled={busy} className={`${btnSize} px-2 rounded border border-line text-muted-foreground hover:text-foreground hover:border-line2 font-mono uppercase tracking-widest`}>Shorten</button>
            <button onClick={() => run("expand")} disabled={busy} className={`${btnSize} px-2 rounded border border-line text-muted-foreground hover:text-foreground hover:border-line2 font-mono uppercase tracking-widest`}>Expand</button>
            <button onClick={() => run("brainstorm 3 alternatives")} disabled={busy} className={`${btnSize} px-2 rounded border border-line text-muted-foreground hover:text-foreground hover:border-line2 font-mono uppercase tracking-widest`}>Alternatives</button>
          </>
        )}
      </div>
      {suggestion && (
        <div className="mt-2 border border-insight/40 bg-insight/5 rounded-md p-3" data-testid="ai-suggestion">
          <div className="text-[10px] font-mono uppercase tracking-widest text-insight mb-2">AI suggestion</div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{suggestion}</div>
          <div className="mt-3 flex gap-2 justify-end">
            <button onClick={reject} className="h-7 px-2 text-[11px] font-mono rounded border border-line text-muted-foreground hover:text-negative flex items-center gap-1" data-testid="ai-reject-btn"><X className="w-3 h-3" /> Discard</button>
            <button onClick={apply} className="h-7 px-2 text-[11px] font-mono rounded bg-insight text-black hover:bg-insight/90 flex items-center gap-1" data-testid="ai-apply-btn"><Check className="w-3 h-3" /> Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
