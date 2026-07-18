import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check } from "lucide-react";

const TIERS = [
  { name: "Free", price: 0, features: ["Command Center", "5 watchlist tickers", "10 AI queries/mo", "Basic screener"] },
  { name: "Pro", price: 29, features: ["Unlimited watchlists", "500 AI queries/mo", "Valuation Lab", "Alerts", "Documents RAG"], featured: true },
  { name: "Team", price: 79, features: ["Everything in Pro", "5 team seats", "Shared research", "Approval workflow", "Priority support"] },
  { name: "Enterprise", price: null, features: ["Unlimited seats", "SSO / SAML", "Custom data sources", "Dedicated CSM", "SLA & audit logs"] },
];

export default function Settings() {
  const { user } = useAuth();
  const upgrade = () => toast("Stripe checkout will activate once keys are configured.", { icon: "⚡" });

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
