import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import AIAssist from "@/components/AIAssist";

export default function Research() {
  const [notes, setNotes] = useState([]);
  const [active, setActive] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = () => api.get("/notes").then(r => setNotes(r.data));
  useEffect(() => { load(); }, []);

  const createNew = () => { setActive(null); setTitle("Untitled note"); setContent(""); };
  const openNote = (n) => { setActive(n); setTitle(n.title); setContent(n.content); };

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (active) {
      await api.put(`/notes/${active.note_id}`, { title, content, ticker: active.ticker });
    } else {
      const { data } = await api.post("/notes", { title, content });
      setActive(data);
    }
    toast.success("Saved");
    load();
  };
  const remove = async (id) => { await api.delete(`/notes/${id}`); if (active?.note_id === id) { setActive(null); setTitle(""); setContent(""); } load(); };

  return (
    <div className="p-6" data-testid="research-page">
      <h1 className="text-3xl font-light tracking-tighter mb-4">Research Notebook</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 border border-line bg-panel rounded-md">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="overline">Notes</span>
            <Button size="sm" variant="ghost" onClick={createNew} data-testid="new-note-btn"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {notes.map(n => (
              <div key={n.note_id} onClick={() => openNote(n)}
                className={`px-3 py-2 border-b border-line cursor-pointer group ${active?.note_id === n.note_id ? "bg-surface" : "hover:bg-surface"}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{n.title}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{new Date(n.updated_at).toLocaleDateString()}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); remove(n.note_id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-negative"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {notes.length === 0 && <div className="p-4 text-xs text-muted-foreground">No notes yet.</div>}
          </div>
        </div>
        <div className="col-span-9 border border-line bg-panel rounded-md p-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" className="bg-transparent border-0 text-xl font-light tracking-tight focus-visible:ring-0 mb-3" data-testid="note-title" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} data-testid="note-content"
            className="w-full bg-base border border-line rounded-md p-3 text-sm font-mono resize-none text-foreground" placeholder="Write your research…" />
          <div className="mt-3">
            <AIAssist contextType="note" text={content} onApply={setContent} label="AI · Rewrite note" />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={save} data-testid="save-note-btn">Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
