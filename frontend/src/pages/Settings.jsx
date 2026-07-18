import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";

const TIERS = [
  { name: "Free", price: 0, features: ["Command Center", "5 watchlist tickers", "10 AI queries/mo", "Basic screener"] },
  { name: "Pro", price: 29, features: ["Unlimited watchlists", "500 AI queries/mo", "Valuation Lab", "Alerts", "Documents RAG"], featured: true },
  { name: "Team", price: 79, features: ["Everything in Pro", "5 team seats", "Shared research", "Approval workflow", "Priority support"] },
  { name: "Enterprise", price: null, features: ["Unlimited seats", "SSO / SAML", "Custom data sources", "Dedicated CSM", "SLA & audit logs"] },
];

export default function Settings() {
  const { user } = useAuth();
  const [sched, setSched] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const upgrade = () => toast("Stripe checkout will activate once keys are configured.", { icon: "⚡" });

  useEffect(() => { api.get("/scheduler/status").then(r => setSched(r.data)).catch(() => {}); }, []);

  const runNow = async () => {
    setTriggering(true);
    try {
      const { data } = await api.post("/scheduler/run-now");
      toast.success(`Scanned ${data.scanned} theses · ${data.triggered.length} auto-checked`);
      const s = await api.get("/scheduler/status"); setSched(s.data);
    } finally { setTriggering(false); }
  };

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      <h1 className="text-3xl font-light tracking-tighter">Settings</h1>

      <div className="border border-line bg-panel rounded-md p-5">
        <div className="overline mb-3">Account</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground text-xs">Name</div><div>{user?.name || "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">Email</div><div className="font-mono">{user?.email}</div></div>
          <div><div className="text-muted-foreground text-xs">Role</div><div>{user?.role || "Owner"}</div></div>
          <div><div className="text-muted-foreground text-xs">Current Plan</div><div className="text-terminal">{user?.plan || "Free"}</div></div>
        </div>
      </div>

      <div className="border border-line bg-panel rounded-md p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-terminal" /><div className="overline">Background Scheduler · Thesis Auto-Recheck</div></div>
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90 h-7 text-xs" onClick={runNow} disabled={triggering} data-testid="scheduler-run-now-btn">
            <Zap className="w-3 h-3 mr-1" /> {triggering ? "Running…" : "Trigger Now"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          The scheduler runs every 6 hours. For each living thesis, it checks the ticker for earnings-related news or a ≥5% price move; if either signal fires, it re-runs the AI Assumption Check automatically. All triggered runs appear below.
        </div>
        {sched?.jobs?.map(j => (
          <div key={j.id} className="text-[11px] font-mono text-muted-foreground mb-1">
            › job <span className="text-foreground">{j.id}</span> · next run <span className="text-terminal">{j.next_run}</span>
          </div>
        ))}
        {sched?.recent_runs?.length > 0 ? (
          <div className="mt-3 space-y-1">
            <div className="overline mb-1">Recent Auto-Checks</div>
            {sched.recent_runs.slice(0, 10).map(r => (
              <div key={r.run_id} className="text-[11px] font-mono flex items-center gap-3">
                <span className="text-muted-foreground w-32">{new Date(r.at).toLocaleString()}</span>
                <span className="text-terminal w-14">{r.ticker}</span>
                <span className="text-muted-foreground">{r.reason}</span>
                {r.at_risk_count > 0 && <span className="text-warning">at_risk: {r.at_risk_count}</span>}
                {r.broken_count > 0 && <span className="text-negative">broken: {r.broken_count}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-muted-foreground mt-3">No auto-checks yet. They will populate after the next material event on any of your ticker theses.</div>
        )}
      </div>

      <div>
        <div className="overline mb-3">Subscription Plans</div>
        <div className="grid grid-cols-4 gap-4">
          {TIERS.map(t => (
            <div key={t.name} className={`border rounded-md p-5 relative ${t.featured ? "border-terminal bg-panel" : "border-line bg-panel"}`} data-testid={`plan-${t.name.toLowerCase()}`}>
              {t.featured && <div className="absolute -top-2 left-4 bg-terminal text-black text-[9px] font-mono px-2 py-0.5 rounded uppercase tracking-widest">Popular</div>}
              <div className="text-lg font-light tracking-tighter mb-1">{t.name}</div>
              <div className="font-mono text-2xl mb-4">{t.price === null ? "Custom" : t.price === 0 ? "Free" : `$${t.price}/mo`}</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground mb-4">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5"><Check className="w-3 h-3 text-positive mt-0.5 flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <Button size="sm" onClick={upgrade} className={`w-full ${t.featured ? "bg-terminal text-black hover:bg-terminal/90" : "bg-surface hover:bg-line text-foreground"}`} data-testid={`upgrade-${t.name.toLowerCase()}-btn`}>
                {user?.plan === t.name ? "Current" : t.price === null ? "Contact Sales" : "Upgrade"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
