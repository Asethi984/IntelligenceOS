import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Save, RotateCcw, Search } from "lucide-react";

export default function AgentPrompts() {
  const [prompts, setPrompts] = useState([]);
  const [editing, setEditing] = useState({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/agents/prompts");
      setPrompts(data.prompts);
      const editMap = {};
      data.prompts.forEach(p => { editMap[p.key] = p.system_prompt; });
      setEditing(editMap);
    } catch (e) {
      toast.error("Failed to load agent prompts");
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (key) => {
    setSaving(key);
    try {
      await api.put(`/agents/prompts/${key}`, { system_prompt: editing[key] });
      toast.success(`${key} prompt saved (live, no redeploy needed)`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally { setSaving(null); }
  };

  const reset = async (key) => {
    try {
      const { data } = await api.post(`/agents/prompts/${key}/reset`);
      setEditing({ ...editing, [key]: data.system_prompt });
      toast.success(`${key} reset to default`);
      load();
    } catch (e) {
      toast.error("Failed to reset");
    }
  };

  const filtered = prompts.filter(p =>
    p.key.toLowerCase().includes(search.toLowerCase()) ||
    p.system_prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4" data-testid="agent-prompts-page">
      <div>
        <h1 className="text-3xl font-light tracking-tighter">Agent System Prompts</h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Edit any agent's system prompt. Changes are persisted in DB and take effect immediately — no container redeploy needed.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search agents or prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-panel border-line"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{filtered.length} agents</span>
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.key} className="border border-line bg-panel rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-terminal" />
                <div>
                  <div className="text-sm font-mono">{p.key}</div>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                    {p.model} · temp {p.temperature} · max_evidence {p.max_evidence}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.is_custom && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-terminal text-terminal">
                    CUSTOM
                  </span>
                )}
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => reset(p.key)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
                <Button
                  size="sm" className="bg-terminal text-black hover:bg-terminal/90 h-7 text-xs"
                  onClick={() => save(p.key)}
                  disabled={saving === p.key || editing[p.key] === p.system_prompt}
                >
                  <Save className="w-3 h-3 mr-1" /> {saving === p.key ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <textarea
              value={editing[p.key] || ""}
              onChange={(e) => setEditing({ ...editing, [p.key]: e.target.value })}
              rows={3}
              className="w-full bg-base border border-line rounded-md p-3 text-xs font-mono resize-y"
              data-testid={`prompt-editor-${p.key}`}
            />
            {p.updated_at && (
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                Last updated: {new Date(p.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
