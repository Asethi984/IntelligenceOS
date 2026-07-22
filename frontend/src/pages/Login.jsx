import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export default function Login({ mode = "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, signup, user } = useAuth();
  const nav = useNavigate();
  const isSignup = mode === "signup";

  // If already logged in, redirect to app
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) await signup(email, password, name);
      else await login(email, password);
      nav("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid={isSignup ? "signup-form" : "login-form"}>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded bg-terminal flex items-center justify-center"><Zap className="w-4 h-4 text-black" strokeWidth={2.5} /></div>
            <div>
              <div className="text-lg font-semibold tracking-tight">IntelligenceOS</div>
              <div className="overline">AI investment intelligence</div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-light tracking-tighter mb-1">{isSignup ? "Create account" : "Sign in"}</h1>
            <p className="text-xs text-muted-foreground">{isSignup ? "Set up your analyst workspace" : "Access your research terminal"}</p>
          </div>
          {isSignup && (
            <div>
              <Label className="overline">Name</Label>
              <Input data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 bg-panel border-line" />
            </div>
          )}
          <div>
            <Label className="overline">Email</Label>
            <Input data-testid="email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 bg-panel border-line" />
          </div>
          <div>
            <Label className="overline">Password</Label>
            <Input data-testid="password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1 bg-panel border-line" />
          </div>
          <Button type="submit" disabled={busy} data-testid="submit-auth-btn" className="w-full bg-terminal text-black hover:bg-terminal/90 font-medium">
            {busy ? "Working…" : (isSignup ? "Create account" : "Sign in")}
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            {isSignup ? (<>Already have an account? <Link to="/login" className="text-terminal hover:underline">Sign in</Link></>) : (<>New here? <Link to="/signup" className="text-terminal hover:underline">Create account</Link></>)}
          </div>
        </form>
      </div>
      <div className="hidden lg:block flex-1 relative border-l border-line bg-panel overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1689443111130-6e9c7dfd8f9e?crop=entropy&cs=srgb&fm=jpg&q=85)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.25 }} />
        <div className="absolute inset-0 bg-gradient-to-tr from-base via-transparent to-transparent" />
        <div className="relative p-10 h-full flex flex-col justify-end">
          <div className="overline mb-3">terminal · v1.0</div>
          <h2 className="text-4xl font-light tracking-tighter leading-tight max-w-md">
            Evidence-backed investment intelligence, at analyst velocity.
          </h2>
          <div className="mt-8 space-y-1.5 font-mono text-xs text-muted-foreground max-w-md">
            <div>› 7 specialized AI agents · streaming reasoning</div>
            <div>› RAG-anchored citations · confidence scoring</div>
            <div>› Portfolio · Valuation · Screeners · Knowledge Graph</div>
          </div>
        </div>
      </div>
    </div>
  );
}
