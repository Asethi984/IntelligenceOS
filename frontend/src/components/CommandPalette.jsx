import { useState, useEffect } from "react";
import { CommandDialog, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Search, Building2, LayoutDashboard, Briefcase, LineChart, FileText, Bell, Users, Settings, Bot, Filter, Network } from "lucide-react";

const NAV_ITEMS = [
  { label: "Command Center", to: "/", icon: LayoutDashboard },
  { label: "Markets", to: "/markets", icon: LineChart },
  { label: "Portfolio", to: "/portfolio", icon: Briefcase },
  { label: "Research Notebook", to: "/research", icon: FileText },
  { label: "AI Agents", to: "/agents", icon: Bot },
  { label: "Screeners", to: "/screeners", icon: Filter },
  { label: "Valuation Lab", to: "/valuation", icon: LineChart },
  { label: "Documents", to: "/documents", icon: FileText },
  { label: "Alerts", to: "/alerts", icon: Bell },
  { label: "Knowledge Graph", to: "/graph", icon: Network },
  { label: "Team", to: "/team", icon: Users },
  { label: "Settings", to: "/settings", icon: Settings },
];

export default function CommandPalette({ open, setOpen }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(!open); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(data.results || []);
      } catch { setResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const go = (path) => { setOpen(false); setQuery(""); nav(path); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput data-testid="cmdk-input" placeholder="Search tickers, pages, or ask AI…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Companies">
            {results.map((r) => (
              <CommandItem key={r.ticker} onSelect={() => go(`/company/${r.ticker}`)} data-testid={`cmdk-result-${r.ticker}`}>
                <Building2 className="w-4 h-4 mr-2 text-terminal" />
                <span className="font-mono mr-2">{r.ticker}</span>
                <span className="text-muted-foreground">{r.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
