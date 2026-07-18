import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, Trash2 } from "lucide-react";
import AIPanel from "@/components/AIPanel";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null);
  const fileRef = useRef();

  const load = () => api.get("/documents").then(r => setDocs(r.data));
  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Uploaded"); load();
    } catch { toast.error("Upload failed"); }
  };

  const ask = async () => {
    if (!active || !q.trim()) return;
    setBusy(true); setAi(null);
    try {
      const { data } = await api.post(`/documents/${active.doc_id}/ask`, { question: q });
      setAi(data);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6" data-testid="documents-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-light tracking-tighter">Documents</h1>
        <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => fileRef.current.click()} data-testid="upload-doc-btn">
          <Upload className="w-3.5 h-3.5 mr-1" /> Upload
        </Button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" hidden onChange={upload} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 border border-line bg-panel rounded-md">
          <div className="overline px-4 py-2.5 border-b border-line">Library</div>
          <div className="max-h-[70vh] overflow-y-auto">
            {docs.map(d => (
              <div key={d.doc_id} onClick={() => setActive(d)} className={`px-4 py-2.5 border-b border-line cursor-pointer flex items-center gap-2 ${active?.doc_id === d.doc_id ? "bg-surface" : "hover:bg-surface"}`}>
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.filename}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{(d.size/1024).toFixed(1)}KB · {new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
            {docs.length === 0 && <div className="p-4 text-xs text-muted-foreground">No documents uploaded.</div>}
          </div>
        </div>
        <div className="col-span-8 space-y-4">
          <div className="border border-line bg-panel rounded-md p-4">
            <div className="overline mb-2">Ask about {active?.filename || "…"}</div>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} disabled={!active} placeholder="e.g., 'What are the top 3 risks in this filing?'"
              className="w-full bg-base border border-line rounded-md p-3 text-sm resize-none font-mono" data-testid="doc-question" />
            <div className="mt-2 flex justify-end">
              <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={ask} disabled={!active || busy} data-testid="ask-doc-btn">Ask</Button>
            </div>
          </div>
          <AIPanel result={ai} loading={busy} title="Document Intelligence" />
        </div>
      </div>
    </div>
  );
}
