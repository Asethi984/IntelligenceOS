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

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
            <div className="relative flex justify-center"><span className="bg-base px-2 overline">or</span></div>
          </div>
          <Button type="button" variant="outline" onClick={google} data-testid="google-auth-btn" className="w-full border-line bg-panel hover:bg-surface">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.1 1.6L19 3.7C17.1 2 14.7 1 12 1 7.4 1 3.4 3.6 1.4 7.5l3.4 2.6C5.8 7 8.6 5 12 5z"/><path fill="#4285F4" d="M23 12c0-.8-.1-1.6-.2-2.4H12v4.6h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7C21.7 18.4 23 15.5 23 12z"/><path fill="#FBBC05" d="M4.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1L1.4 7.3C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.4-2.6z"/><path fill="#34A853" d="M12 23c3.2 0 5.9-1 7.9-2.8l-3.5-2.7c-1 .7-2.3 1.1-4.4 1.1-3.4 0-6.2-2-7.2-4.7l-3.4 2.6C3.4 20.4 7.4 23 12 23z"/></svg>
            Continue with Google
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
