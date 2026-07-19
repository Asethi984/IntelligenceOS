import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Zap, Bot, GitBranch, BookOpen, LineChart, Shield, Sparkles, Check, ArrowRight, Github } from "lucide-react";

const AGENTS = [
  { key: "Research",       desc: "Senior equity analyst — bull/bear synthesis" },
  { key: "Financial",      desc: "CFA — margins, quality of earnings, ratios" },
  { key: "Competitor",     desc: "Porter · moat · pricing power" },
  { key: "Risk",           desc: "Tail risks · beta · debt · short interest" },
  { key: "Valuation",      desc: "DCF · comps · EV/EBITDA · scenario" },
  { key: "Macro",          desc: "Rates · oil · USD · policy" },
  { key: "News",           desc: "Impact + sentiment" },
  { key: "Contradiction",  desc: "10-K vs call vs guidance vs news" },
  { key: "Management",     desc: "Capital allocation · execution" },
  { key: "Materiality",    desc: "Signal from noise" },
  { key: "Earnings Diff",  desc: "Line-by-line quarter comparison" },
  { key: "Bias Detector",  desc: "Your decision journal · patterns" },
];

const FEATURES = [
  { icon: Bot,       title: "12 differentiated AI agents", body: "Not just prompts — each agent gets its own real-time signals (10y yield for Macro, peer quotes for Competitor, income statement for Financial) and its own temperature. Powered by GPT-5.4." },
  { icon: GitBranch, title: "Living Investment Thesis",   body: "Assumptions · catalysts · risks · confidence · versions. Auto-rechecked when earnings hit or price moves ≥5%. See exactly what changed between v1 and v2." },
  { icon: BookOpen,  title: "Decision Journal + Bias",    body: "Every buy/sell logged with reason, expected outcome, and confidence. AI reviews your patterns to surface confirmation bias, recency bias, loss aversion." },
  { icon: LineChart, title: "TradingView-style Board",    body: "Stocks · Crypto · ETFs · sparklines · sortable · 9 chart periods (1D → MAX). Multi-asset watchlists with real live quotes." },
  { icon: Shield,    title: "Evidence-Anchored RAG",      body: "Upload filings, transcripts, memos. Cross-document contradiction detection cites source filename + chunk." },
  { icon: Sparkles,  title: "AI Writing Assist Everywhere",body: "One click to rewrite a thesis narrative, sharpen a journal reason, or brainstorm risks — from any text field in the app." },
];

const PLANS = [
  { name: "Free",  price: 0,   features: ["Command Center", "5 additional tickers per list", "10 AI queries/month", "Basic screener"] },
  { name: "Pro",   price: 29,  featured: true, features: ["Unlimited watchlists", "500 AI queries/month", "Valuation Lab", "Living Thesis + Auto-Recheck", "Documents RAG"] },
  { name: "Team",  price: 79,  features: ["Everything in Pro", "5 team seats", "Shared research + memos", "Approval workflow", "Priority support"] },
  { name: "Enterprise", price: null, features: ["Unlimited seats", "SSO / SAML", "Custom data sources", "SLA + audit logs", "Dedicated CSM"] },
];

export default function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  const [spy, setSpy] = useState(null);
  useEffect(() => {
    // Fetch a snapshot of S&P for a marketing tile (no auth needed via public sample? We'll fake w/ a static preview)
    const seed = Array.from({length: 60}, (_,i) => 100 + Math.sin(i/5)*8 + Math.random()*4 + i*0.4);
    setSpy(seed);
  }, []);

  return (
    <div className="min-h-screen bg-base text-foreground" data-testid="landing-page">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-line bg-base/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-terminal flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-black" strokeWidth={2.5} /></div>
            <span className="font-semibold tracking-tight">IntelligenceOS</span>
            <span className="overline text-[9px] ml-1">v1.0 · terminal</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#agents" className="hover:text-foreground">Agents</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="landing-signin">Sign in</Button></Link>
            <Link to="/signup"><Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" data-testid="landing-getstarted">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(249,115,22,0.15), transparent 40%), radial-gradient(circle at 80% 60%, rgba(129,140,248,0.12), transparent 45%)" }} />
        <div className="max-w-7xl mx-auto px-6 py-24 relative">
          <div className="max-w-3xl">
            <div className="overline mb-4">Bloomberg × Substack for retail alpha</div>
            <h1 className="text-5xl lg:text-7xl font-light tracking-tighter leading-[1.05] mb-6">
              Investment intelligence,<br />
              <span className="text-terminal">at analyst velocity.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8">
              12 specialized AI agents · real market data · Living Theses that auto-recheck themselves ·
              a Decision Journal that catches your own biases. Every claim cites its source.
            </p>
            <div className="flex items-center gap-3">
              <Link to="/signup"><Button className="bg-terminal text-black hover:bg-terminal/90 h-11 px-6" data-testid="landing-cta-primary">Start free <ArrowRight className="w-4 h-4 ml-1.5" /></Button></Link>
              <Link to="/login"><Button variant="outline" className="border-line h-11 px-6" data-testid="landing-cta-secondary">Sign in</Button></Link>
              <span className="text-[11px] font-mono text-muted-foreground ml-2">no card · 10 free AI queries</span>
            </div>
          </div>

          {/* mini terminal preview */}
          <div className="mt-16 grid grid-cols-3 gap-3 max-w-4xl">
            {[
              {l:"S&P 500", v:"7,457", c:"-1.01%", cls:"text-negative"},
              {l:"NVDA · SCORE", v:"78", c:"BUY", cls:"text-positive"},
              {l:"THESIS · v3", v:"3 assumptions", c:"1 at risk", cls:"text-warning"},
            ].map((k,i) => (
              <div key={i} className="border border-line bg-panel rounded-md p-4">
                <div className="overline mb-1">{k.l}</div>
                <div className="font-mono text-2xl tracking-tight">{k.v}</div>
                <div className={`font-mono text-xs ${k.cls}`}>{k.c}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section id="agents" className="border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="mb-10">
            <div className="overline mb-3">The Agent Council</div>
            <h2 className="text-4xl font-light tracking-tighter">12 minds. One ticker. Zero fluff.</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl">Each agent is genuinely different — different temperature, different real-time signals, different question. Every response is JSON-structured with Summary · Evidence · Sources · Confidence · Assumptions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {AGENTS.map(a => (
              <div key={a.key} className="border border-line bg-panel rounded-md p-4 hover:border-line2 transition-colors">
                <div className="flex items-center gap-2 mb-1"><Bot className="w-3.5 h-3.5 text-terminal" /><span className="font-medium">{a.key}</span></div>
                <div className="text-xs text-muted-foreground">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="mb-10">
            <div className="overline mb-3">What you get</div>
            <h2 className="text-4xl font-light tracking-tighter">Six things nobody else has stitched together.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((f,i) => (
              <div key={i} className="border border-line bg-panel rounded-md p-6">
                <f.icon className="w-5 h-5 text-terminal mb-3" />
                <div className="font-medium mb-2">{f.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="mb-10 text-center">
            <div className="overline mb-3">Pricing</div>
            <h2 className="text-4xl font-light tracking-tighter">Free forever. Pro when you&apos;re ready.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {PLANS.map(p => (
              <div key={p.name} className={`border rounded-md p-6 relative ${p.featured ? "border-terminal bg-panel" : "border-line bg-panel"}`}>
                {p.featured && <div className="absolute -top-2 left-4 bg-terminal text-black text-[9px] font-mono px-2 py-0.5 rounded uppercase tracking-widest">Popular</div>}
                <div className="text-xl font-light tracking-tighter mb-1">{p.name}</div>
                <div className="font-mono text-3xl mb-5">{p.price === null ? "Custom" : p.price === 0 ? "Free" : `$${p.price}`}<span className="text-xs text-muted-foreground">{p.price ? "/mo" : ""}</span></div>
                <ul className="space-y-2 text-xs text-muted-foreground mb-6">
                  {p.features.map(f => <li key={f} className="flex items-start gap-2"><Check className="w-3 h-3 text-positive mt-0.5 flex-shrink-0" />{f}</li>)}
                </ul>
                <Link to="/signup" className="block"><Button size="sm" className={`w-full ${p.featured ? "bg-terminal text-black hover:bg-terminal/90" : "bg-surface hover:bg-line text-foreground"}`} data-testid={`landing-plan-${p.name.toLowerCase()}`}>
                  {p.price === null ? "Contact sales" : p.price === 0 ? "Start free" : "Start free trial"}
                </Button></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="max-w-7xl mx-auto px-6 py-10 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-terminal" />
            <span>IntelligenceOS · v1.0</span>
          </div>
          <div className="font-mono">Not investment advice · educational use</div>
        </div>
      </footer>
    </div>
  );
}
