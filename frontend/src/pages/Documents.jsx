import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileText, Trash2, GitCompare } from "lucide-react";
import AIPanel from "@/components/AIPanel";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null);
  const [contradictionTicker, setContradictionTicker] = useState("");
  const [contradictionBusy, setContradictionBusy] = useState(false);
  const [contradictionResult, setContradictionResult] = useState(null);
  const [uploadTicker, setUploadTicker] = useState("");
  const fileRef = useRef();

  const load = () => api.get("/documents").then(r => setDocs(r.data));
  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const url = uploadTicker ? `/documents/upload?ticker=${encodeURIComponent(uploadTicker)}` : "/documents/upload";
    try {
      await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Uploaded and indexed"); setUploadTicker(""); load();
    } catch { toast.error("Upload failed"); }
    e.target.value = "";
  };

  const ask = async () => {
    if (!active || !q.trim()) return;
    setBusy(true); setAi(null);
    try {
      const { data } = await api.post(`/documents/${active.doc_id}/ask`, { question: q });
      setAi(data);
    } finally { setBusy(false); }
  };

  const remove = async (id) => { await api.delete(`/documents/${id}`); if (active?.doc_id === id) setActive(null); load(); };

  const runContradiction = async () => {
    setContradictionBusy(true); setContradictionResult(null);
    try {
      const { data } = await api.post("/documents/contradiction", { ticker: contradictionTicker || null });
      setContradictionResult(data);
    } finally { setContradictionBusy(false); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="documents-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-light tracking-tighter">Documents · RAG</h1>
        <div className="flex gap-2 items-center">
          <Input placeholder="Ticker (optional)" value={uploadTicker} onChange={(e) => setUploadTicker(e.target.value.toUpperCase())} className="bg-panel border-line font-mono w-36 h-9" />
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => fileRef.current.click()} data-testid="upload-doc-btn">
            <Upload className="w-3.5 h-3.5 mr-1" /> Upload
          </Button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" hidden onChange={upload} />
        </div>
      </div>

      {/* Cross-document contradiction detection */}
      <div className="border border-line bg-panel rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><GitCompare className="w-3.5 h-3.5 text-insight" /><span className="overline">Cross-Document Contradiction Detection</span></div>
          <div className="flex gap-2">
            <Input placeholder="Filter by ticker (optional)" value={contradictionTicker} onChange={(e) => setContradictionTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono w-40 h-8" />
            <Button size="sm" className="bg-insight text-black hover:bg-insight/90 h-8" onClick={runContradiction} disabled={contradictionBusy} data-testid="find-contradictions-btn">
              {contradictionBusy ? "Analyzing…" : "Find Contradictions"}
            </Button>
          </div>
        </div>
        {contradictionResult ? (
          <div className="space-y-2">
            {contradictionResult.retrieved != null && (
              <div className="text-xs text-muted-foreground font-mono">
                › Retrieved {contradictionResult.retrieved} chunks · sources: {(contradictionResult.source_files || []).join(", ")}
              </div>
            )}
            <AIPanel result={contradictionResult} title="Contradiction Analysis" />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Upload two or more filings/transcripts and this will surface inconsistencies via BM25 retrieval + GPT-5.2. Cite by filename + chunk.</div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 border border-line bg-panel rounded-md">
          <div className="overline px-4 py-2.5 border-b border-line">Library ({docs.length})</div>
          <div className="max-h-[60vh] overflow-y-auto">
            {docs.map(d => (
              <div key={d.doc_id} onClick={() => setActive(d)} className={`px-4 py-2.5 border-b border-line cursor-pointer group flex items-center gap-2 ${active?.doc_id === d.doc_id ? "bg-surface" : "hover:bg-surface"}`}>
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.filename}</div>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                    {d.ticker && <span className="text-terminal">{d.ticker}</span>}
                    <span>{(d.size/1024).toFixed(1)}KB · {d.chunk_count || 0} chunks</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); remove(d.doc_id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-negative"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            {docs.length === 0 && <div className="p-4 text-xs text-muted-foreground">No documents uploaded.</div>}
          </div>
        </div>
        <div className="col-span-8 space-y-4">
          <div className="border border-line bg-panel rounded-md p-4">
            <div className="overline mb-2">Ask about {active?.filename || "…"}</div>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} disabled={!active} placeholder="e.g., 'What are the top 3 risks in this filing?'"
              className="w-full bg-base border border-line rounded-md p-3 text-sm resize-none font-mono disabled:opacity-50" data-testid="doc-question" />
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
