import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Sparkles } from "lucide-react";

const STAGES = ["idea","research","validation","buy","monitor","review","archive"];
const STAGE_LABELS = { idea: "Idea", research: "Research", validation: "Validation", buy: "Buy", monitor: "Monitor", review: "Review", archive: "Archive" };
const STAGE_COLORS = {
  idea: "border-t-insight", research: "border-t-warning", validation: "border-t-terminal",
  buy: "border-t-positive", monitor: "border-t-positive", review: "border-t-warning", archive: "border-t-line2",
};

const fmt = (n) => (n == null ? "—" : Number(n).toFixed(2));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

export default function Pipeline() {
  const [data, setData] = useState({ stages: STAGES, items: {} });
  const [ticker, setTicker] = useState("");
  const [stage, setStage] = useState("idea");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const load = () => api.get("/pipeline").then(r => setData(r.data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!ticker) return toast.error("Ticker required");
    await api.post("/pipeline", { ticker, stage, note });
    setOpen(false); setTicker(""); setNote(""); toast.success("Added"); load();
  };

  const move = async (item_id, new_stage) => {
    await api.post("/pipeline/move", { item_id, new_stage });
    load();
  };

  const remove = async (id) => { await api.delete(`/pipeline/${id}`); load(); };

  return (
    <div className="p-6 space-y-4" data-testid="pipeline-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Investment Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Idea → Research → Validation → Buy → Monitor → Review → Archive</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-line" onClick={async () => { await api.post("/demo/seed"); toast.success("Demo pipeline loaded"); load(); }} data-testid="seed-pipeline-btn">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Load Sample
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" data-testid="add-pipeline-btn">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add to Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-panel border-line">
            <DialogHeader><DialogTitle>Add to Pipeline</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="pl-ticker" />
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="bg-base border-line"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="bg-base border-line" />
              <Button className="w-full bg-terminal text-black hover:bg-terminal/90" onClick={add} data-testid="submit-pipeline-btn">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 min-h-[70vh]">
        {STAGES.map((s) => {
          const items = data.items[s] || [];
          return (
            <div key={s} className={`bg-panel border border-line ${STAGE_COLORS[s]} border-t-2 rounded-md flex flex-col`} data-testid={`stage-${s}`}>
              <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                <span className="overline">{STAGE_LABELS[s]}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {items.map((it) => (
                  <div key={it.item_id} className="bg-base border border-line rounded p-2 group">
                    <div className="flex items-center justify-between mb-1">
                      <button onClick={() => nav(`/company/${it.ticker}`)} className="font-mono text-sm hover:text-terminal" data-testid={`pl-item-${it.ticker}`}>{it.ticker}</button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => remove(it.item_id)} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span>${fmt(it.price)}</span>
                      <span className={pct(it.change_pct)}>{fmt(it.change_pct)}%</span>
                    </div>
                    {it.note && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{it.note}</p>}
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {STAGES.filter(x => x !== s).slice(0, 4).map(x => (
                        <button key={x} onClick={() => move(it.item_id, x)}
                          className="text-[9px] font-mono text-muted-foreground hover:text-terminal border border-line rounded px-1 py-0.5 uppercase tracking-widest">
                          →{x.slice(0,3)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-4">empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
