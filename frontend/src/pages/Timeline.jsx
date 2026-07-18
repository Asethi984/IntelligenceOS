import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper, FileText, TrendingUp, TrendingDown, Eye, Circle } from "lucide-react";

const ICONS = {
  news: Newspaper, thesis: FileText,
  journal_buy: TrendingUp, journal_sell: TrendingDown,
  journal_hold: Circle, journal_watch: Eye,
};
const COLORS = {
  news: "text-insight", thesis: "text-terminal",
  journal_buy: "text-positive", journal_sell: "text-negative",
  journal_hold: "text-warning", journal_watch: "text-muted-foreground",
};

export default function Timeline() {
  const { ticker } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(ticker || "AAPL");
  const [active, setActive] = useState(ticker || "AAPL");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!active) return;
    api.get(`/timeline/${active}`).then(r => setEvents(r.data.events || []));
  }, [active]);

  return (
    <div className="p-6 space-y-4" data-testid="timeline-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tighter">Investment Timeline · {active}</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">All events on one thread — news, filings, theses, journal entries</p>
        </div>
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} className="bg-base border-line font-mono w-32" />
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => { setActive(input); nav(`/timeline/${input}`); }} data-testid="load-timeline-btn">Load</Button>
        </div>
      </div>

      <div className="relative pl-6 border-l border-line ml-2">
        {events.map((e, i) => {
          const Ic = ICONS[e.type] || Circle;
          const col = COLORS[e.type] || "text-muted-foreground";
          return (
            <div key={i} className="relative pb-5 group">
              <div className={`absolute -left-8 top-1 w-3 h-3 rounded-full bg-base border-2 ${col.replace("text-","border-")}`} />
              <div className="border border-line bg-panel rounded-md p-3 group-hover:border-line2 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Ic className={`w-3.5 h-3.5 ${col}`} />
                  <span className="overline">{e.type.replace(/_/g, " ")}</span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-auto">{new Date(e.at).toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  {e.link ? (<a href={e.link} target="_blank" rel="noopener noreferrer" className="hover:text-terminal">{e.title}</a>) : e.title}
                </div>
                {e.meta && <div className="text-xs text-muted-foreground font-mono mt-1">{e.meta}</div>}
              </div>
            </div>
          );
        })}
        {events.length === 0 && <div className="text-xs text-muted-foreground py-6">No events yet for {active}.</div>}
      </div>
    </div>
  );
}
