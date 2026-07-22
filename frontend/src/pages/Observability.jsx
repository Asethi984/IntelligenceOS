import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Activity, AlertCircle, CheckCircle, Clock, Database, Bot, ChevronDown, ChevronRight } from "lucide-react";

export default function Observability() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ type: "all", status: "all", agent: "all" });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const limit = 50;

  const load = async () => {
    try {
      const [s, l] = await Promise.all([
        api.get("/observability/stats"),
        api.get("/observability/logs", {
          params: {
            limit,
            offset: page * limit,
            ...(filters.type !== "all" ? { type: filters.type } : {}),
            ...(filters.status !== "all" ? { status: filters.status } : {}),
            ...(filters.agent !== "all" ? { agent: filters.agent } : {}),
          },
        }),
      ]);
      setStats(s.data);
      setLogs(l.data.logs);
      setTotal(l.data.total);
    } catch (e) {
      toast.error("Failed to load observability data");
    }
  };

  useEffect(() => { load(); }, [page, filters]);

  const fmtMs = (ms) => (ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString() : "—";

  const StatCard = ({ icon: Icon, label, data, color }) => (
    <div className="border border-line bg-panel rounded-md p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <div className="overline">{label}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-mono font-light">{data?.total ?? 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</div>
        </div>
        <div>
          <div className="text-2xl font-mono font-light text-positive">{data?.success ?? 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">OK</div>
        </div>
        <div>
          <div className="text-2xl font-mono font-light text-negative">{data?.error ?? 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Errors</div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs font-mono text-muted-foreground">
        {data?.success_rate ?? 0}% success rate
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6" data-testid="observability-page">
      <div>
        <h1 className="text-3xl font-light tracking-tighter">Observability</h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          LLM gateway calls · data source fetches · error details · latency tracking
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={Bot} label="LLM Gateway Calls" data={stats.llm} color="text-terminal" />
          <StatCard icon={Database} label="Data Source Calls" data={stats.data_source} color="text-insight" />
        </div>
      )}

      {stats?.per_agent?.length > 0 && (
        <div className="border border-line bg-panel rounded-md p-4">
          <div className="overline mb-3">Per-Agent Breakdown</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-line">
                  <th className="text-left py-2 px-3 overline">Agent</th>
                  <th className="text-right py-2 px-3 overline">Calls</th>
                  <th className="text-right py-2 px-3 overline">OK</th>
                  <th className="text-right py-2 px-3 overline">Errors</th>
                  <th className="text-right py-2 px-3 overline">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {stats.per_agent.map(a => (
                  <tr key={a._id} className="border-b border-line hover:bg-surface">
                    <td className="py-2 px-3 font-mono">{a._id}</td>
                    <td className="py-2 px-3 text-right font-mono">{a.total}</td>
                    <td className="py-2 px-3 text-right font-mono text-positive">{a.success}</td>
                    <td className="py-2 px-3 text-right font-mono text-negative">{a.error}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtMs(a.avg_latency_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats?.recent_errors?.length > 0 && (
        <div className="border border-negative/40 bg-negative/5 rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-negative" />
            <div className="overline text-negative">Recent Errors (last 10)</div>
          </div>
          <div className="space-y-2">
            {stats.recent_errors.map((e, i) => (
              <div key={i} className="text-xs font-mono border border-line rounded p-2 bg-panel">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-negative">{e.error_type || "Error"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-terminal">{e.agent || e.operation || "—"}</span>
                  <span className="text-muted-foreground ml-auto">{fmtTime(e.ts)}</span>
                </div>
                <div className="text-negative/80 break-all">{e.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-line bg-panel rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="overline">Event Log ({total} total)</div>
          <div className="flex gap-2 items-center">
            <Select value={filters.type} onValueChange={(v) => { setFilters({...filters, type: v}); setPage(0); }}>
              <SelectTrigger className="w-32 h-8 text-xs bg-base border-line"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="llm_call">LLM Calls</SelectItem>
                <SelectItem value="data_source">Data Sources</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => { setFilters({...filters, status: v}); setPage(0); }}>
              <SelectTrigger className="w-32 h-8 text-xs bg-base border-line"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="border-line h-8 text-xs" onClick={load}>
              <Activity className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="border border-line rounded">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-surface transition-colors"
              >
                {expanded === i ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {log.status === "success" ? (
                  <CheckCircle className="w-3.5 h-3.5 text-positive flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-negative flex-shrink-0" />
                )}
                <span className="font-mono text-muted-foreground w-44 text-left">{fmtTime(log.ts)}</span>
                <span className={`font-mono w-20 ${log.type === "llm_call" ? "text-terminal" : "text-insight"}`}>
                  {log.type}
                </span>
                <span className="font-mono w-28 truncate">{log.agent || log.operation || "—"}</span>
                {log.model && <span className="font-mono text-muted-foreground text-[10px] w-28 truncate">{log.model}</span>}
                {log.ticker && <span className="font-mono text-terminal text-[10px] w-14">{log.ticker}</span>}
                <span className="font-mono text-muted-foreground ml-auto">{fmtMs(log.latency_ms)}</span>
                {log.status === "error" && (
                  <span className="font-mono text-negative text-[10px] truncate max-w-xs">{log.error}</span>
                )}
              </button>
              {expanded === i && (
                <div className="px-6 py-3 border-t border-line bg-base/50 space-y-2 text-xs font-mono">
                  {log.error && (
                    <div>
                      <div className="overline text-negative mb-1">Error</div>
                      <div className="text-negative break-all p-2 bg-negative/10 rounded">{log.error}</div>
                    </div>
                  )}
                  {log.error_type && (
                    <div><span className="text-muted-foreground">Error type:</span> <span className="text-negative">{log.error_type}</span></div>
                  )}
                  {log.traceback && (
                    <div>
                      <div className="overline mb-1">Traceback</div>
                      <pre className="text-[10px] text-muted-foreground bg-panel p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{log.traceback}</pre>
                    </div>
                  )}
                  {log.response_preview && (
                    <div>
                      <div className="overline mb-1">Response Preview</div>
                      <pre className="text-[10px] text-muted-foreground bg-panel p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{log.response_preview}</pre>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div><span className="text-muted-foreground">Prompt length:</span> {log.prompt_length ?? "—"}</div>
                    <div><span className="text-muted-foreground">Response length:</span> {log.response_length ?? "—"}</div>
                    <div><span className="text-muted-foreground">Temperature:</span> {log.temperature ?? "—"}</div>
                    <div><span className="text-muted-foreground">Source:</span> {log.source ?? "—"}</div>
                    <div><span className="text-muted-foreground">Fields:</span> {log.fields_returned ?? "—"}</div>
                    <div><span className="text-muted-foreground">Latency:</span> {fmtMs(log.latency_ms)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              No logs yet. Run an AI agent or trigger a data source to see events here.
            </div>
          )}
        </div>

        {total > limit && (
          <div className="flex items-center justify-between mt-4 text-xs">
            <span className="text-muted-foreground font-mono">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-line h-7 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" className="border-line h-7 text-xs" disabled={(page + 1) * limit >= total} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
