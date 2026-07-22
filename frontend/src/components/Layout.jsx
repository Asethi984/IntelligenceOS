import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, LineChart, Briefcase, FileText, Bot, Filter, Bell, Network, Users, Settings, LogOut, Search, Command, Calculator, FolderOpen, Zap, GitBranch, BookOpen, Clock, LayoutGrid, ThumbsUp, Activity, MessageSquare } from "lucide-react";
import { useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, end: true },
  { to: "/board", label: "Board", icon: LayoutGrid },
  { to: "/ratings", label: "Buy · Sell · Hold", icon: ThumbsUp },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/pipeline", label: "Pipeline", icon: GitBranch },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/research", label: "Research", icon: FileText },
  { to: "/agents", label: "AI Agents", icon: Bot },
  { to: "/screeners", label: "Screeners", icon: Filter },
  { to: "/valuation", label: "Valuation Lab", icon: Calculator },
  { to: "/timeline/AAPL", label: "Timeline", icon: Clock },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/graph", label: "Knowledge Graph", icon: Network },
  { to: "/team", label: "Team", icon: Users },
  { to: "/agent-prompts", label: "Agent Prompts", icon: MessageSquare },
  { to: "/observability", label: "Observability", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-base text-foreground flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-line bg-panel fixed top-0 bottom-0 left-0 flex flex-col z-30">
        <div className="h-14 border-b border-line flex items-center px-4 gap-2">
          <div className="w-6 h-6 rounded bg-terminal flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">IntelligenceOS</div>
            <div className="overline text-[9px]">v1.0 · terminal</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={`nav-${n.label.toLowerCase().replace(/ /g,'-')}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors duration-150 ${isActive ? "bg-surface text-foreground border-l-2 border-terminal pl-2" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`
              }>
              <n.icon className="w-4 h-4" strokeWidth={1.75} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-surface border border-line flex items-center justify-center text-xs font-mono">
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate">{user?.name || user?.email}</div>
              <div className="overline text-[9px]">{user?.plan || "Free"} · {user?.role || "Owner"}</div>
            </div>
            <button onClick={logout} data-testid="logout-btn" className="text-muted-foreground hover:text-negative transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <div className="ml-56 flex-1 min-w-0">
        <header className="h-14 border-b border-line bg-base/80 backdrop-blur-md fixed top-0 right-0 left-56 z-20 flex items-center px-4 gap-3">
          <button onClick={() => setCmdOpen(true)} data-testid="global-search-btn"
            className="flex items-center gap-2 flex-1 max-w-md bg-panel border border-line rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:border-line2 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search markets, companies, agents…</span>
            <div className="ml-auto flex items-center gap-1 text-[10px] font-mono">
              <kbd className="px-1.5 py-0.5 border border-line rounded">⌘</kbd>
              <kbd className="px-1.5 py-0.5 border border-line rounded">K</kbd>
            </div>
          </button>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="pulse-live text-muted-foreground">MARKET · <span className="text-foreground">OPEN</span></span>
            <span className="text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <NotificationBell />
          </div>
        </header>

        <main className="pt-14 min-h-screen">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  );
}
