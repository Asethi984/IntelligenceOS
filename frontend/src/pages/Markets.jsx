import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n > 0 ? "text-positive" : n < 0 ? "text-negative" : "text-muted-foreground");

export default function Markets() {
  const [overview, setOverview] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/market/overview").then(r => setOverview(r.data));
  }, []);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="p-6 space-y-4" data-testid="markets-page">
      <h1 className="text-3xl font-light tracking-tighter">Markets</h1>

      <div className="border border-line bg-panel rounded-md p-4">
        <div className="overline mb-3">Ticker Search</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input data-testid="ticker-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or ticker…" className="pl-9 bg-base border-line font-mono" />
          </div>
        </div>
        {results.length > 0 && (
          <div className="mt-3 space-y-1">
            {results.map(r => (
              <div key={r.ticker} onClick={() => nav(`/company/${r.ticker}`)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-surface rounded cursor-pointer">
                <span className="font-mono text-sm">{r.ticker}</span>
                <span className="text-sm text-muted-foreground">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-line bg-panel rounded-md overflow-hidden">
          <div className="overline px-4 py-2.5 border-b border-line">Indices</div>
          <table className="w-full text-xs">
            <tbody>
              {(overview?.indices || []).map(i => (
                <tr key={i.label} className="border-b border-line hover:bg-surface">
                  <td className="px-4 py-2">{i.label}</td>
                  <td className="px-4 py-2 font-mono text-right">{fmt(i.price)}</td>
                  <td className={`px-4 py-2 font-mono text-right ${pct(i.change_pct)}`}>{fmt(i.change_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-line bg-panel rounded-md overflow-hidden">
          <div className="overline px-4 py-2.5 border-b border-line">Sectors</div>
          <table className="w-full text-xs">
            <tbody>
              {(overview?.sectors || []).map(s => (
                <tr key={s.label} className="border-b border-line hover:bg-surface cursor-pointer" onClick={() => nav(`/company/${s.ticker}`)}>
                  <td className="px-4 py-2">{s.label}</td>
                  <td className="px-4 py-2 font-mono text-right">{fmt(s.price)}</td>
                  <td className={`px-4 py-2 font-mono text-right ${pct(s.change_pct)}`}>{fmt(s.change_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
